import { ButtonBuilder, ButtonStyle, GuildChannel, PermissionFlagsBits } from 'discord.js';
import { GuildMember } from 'discord.js';

import { createAcceptedActionRow } from '../../libs/discord-util.js';
import {
  parseMembershipVerificationRequestEmbed,
  replyInvalidRequest,
} from '../../libs/membership.js';
import Membership, { MembershipDoc } from '../../models/membership.js';
import { OCRMembershipDoc } from '../../models/membership.js';
import User from '../../models/user.js';
import DiscordBotConfig from '../config.js';
import CustomButton from './index.js';

const membershipAcceptButton = new CustomButton({
  customId: 'membership-accept',
  data: new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel('Accept'),
  execute: async (interaction) => {
    const { guild, channel, user: moderator } = interaction;
    if (!guild || !channel || !(channel instanceof GuildChannel)) return;

    // Fetch moderator
    const moderatorMember = await guild.members.fetch({ user: moderator, force: true });
    if (!moderatorMember.permissionsIn(channel).has(DiscordBotConfig.adminPermissions)) {
      await interaction.reply({
        content: 'You do not have `Manage Roles` permission to accept membership requests.',
      });
      return;
    }

    // Parse embed
    const parsedResult = parseMembershipVerificationRequestEmbed(
      interaction.message.embeds[0] ?? null,
    );
    if (!parsedResult) {
      return await replyInvalidRequest(interaction);
    }
    const { userId, createdAt, expireAt, roleId } = parsedResult;

    const reasonableTimeLimit = createdAt.add(60, 'days');
    if (expireAt.isAfter(reasonableTimeLimit)) {
      await interaction.reply({
        content:
          'The recognized date is too far in the future.\n' +
          `The recognized date (\`${expireAt.format(
            'YYYY/MM/DD',
          )}\`) must not be more than 60 days after the request was made (\`${createdAt.format(
            'YYYY/MM/DD',
          )}\`).\n` +
          'Please set the correct date manually.',
      });
      return;
    }

    const role = await guild.roles.fetch(roleId, { force: true });
    if (!role) {
      return await replyInvalidRequest(
        interaction,
        `Failed to retrieve the role <@&${roleId}> from the guild.`,
      );
    }

    await interaction.deferReply();

    // Handle role checks
    const botMember = await guild.members.fetchMe({ force: true });
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.editReply({
        content: `The bot does not have the \`Manage Roles\` permission.\nPlease try again after giving the bot the permission.`,
      });
      return;
    }

    // Fetch guild member
    let member: GuildMember | null = null;
    try {
      member = await guild.members.fetch(userId);
    } catch (error) {
      console.error(error);
    }
    if (!member) {
      await interaction.editReply({
        content: `Failed to retrieve the member <@${userId}> from the guild.`,
      });
      return;
    }

    const dbUser = await User.findByIdAndUpdate(
      member.id,
      {
        $set: {
          username: `${member.user.username}#${member.user.discriminator}`,
          avatar: member.user.displayAvatarURL(),
        },
        $setOnInsert: { _id: member.id },
      },
      {
        upsert: true,
        new: true,
      },
    );

    // Update database
    const populatedDbUser = await User.populate<{ memberships: MembershipDoc[] }>(
      dbUser,
      'memberships',
    );
    const ocrMembership = populatedDbUser.memberships.find(
      (membership): membership is OCRMembershipDoc =>
        membership.type === 'ocr' && membership.membershipRole === roleId,
    );
    if (ocrMembership) {
      ocrMembership.billingDate = expireAt.date();
      ocrMembership.save();
    } else {
      const newMembership = await Membership.build({
        type: 'ocr',
        membershipRole: roleId,
        billingDate: expireAt.date(),
      });
      await newMembership.save();
      populatedDbUser.memberships.push(newMembership);
      await populatedDbUser.save();
    }

    // Add role to member
    try {
      await member.roles.add(role);
    } catch (error) {
      console.error(error);
      await interaction.editReply({
        content: `Due to the role hierarchy, the bot cannot assign the role <@&${role.id}> to users.\nI can only assign a role whose order is lower than that of my highest role <@&${botMember.roles.highest.id}>.`,
      });
      return;
    }

    // DM the user
    const dmChannel = await member.createDM();
    let notified = false;
    try {
      await dmChannel.send({
        content: `You have been granted the membership role **@${role.name}** (ID: ${role.id}) in the server \`${guild.name}\`.`,
      });
      notified = true;
    } catch (error) {
      // User does not allow DMs
    }

    // Mark the request as accepted
    const acceptedActionRow = createAcceptedActionRow();
    await interaction.message.edit({
      components: [acceptedActionRow],
    });
    await interaction.editReply({
      content:
        `**Successfully granted** the membership role <@&${role.id}> to <@${userId}>.` +
        (notified
          ? ''
          : '\nHowever, due to their __Privacy Settings__ of this server, **I cannot send DM to notify them.**\nThus, you might need to notify them yourself.'),
    });
  },
});

export default membershipAcceptButton;
