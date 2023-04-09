import {
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  GuildChannel,
  PermissionFlagsBits,
} from 'discord.js';
import { GuildMember } from 'discord.js';

import { createDisabledAcceptedActionRow } from '../../libs/discord-util.js';
import {
  parseMembershipVerificationRequestEmbed,
  replyInvalidRequest,
} from '../../libs/membership.js';
import MembershipCollection from '../../models/membership.js';
import UserCollection from '../../models/user.js';
import DiscordBotConfig from '../config.js';
import CustomButton from './index.js';

const membershipAcceptButton = new CustomButton({
  customId: 'membership-accept',
  data: new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel('Accept'),
  execute: async (interaction) => {
    const { guild, channel, user: moderator, client } = interaction;
    if (!guild || !channel || !(channel instanceof GuildChannel)) return;

    // Moderator permission check
    if (!channel.permissionsFor(moderator)?.has(DiscordBotConfig.moderatorPermissions)) {
      await interaction.reply({
        content: 'You do not have `Manage Roles` permission to accept membership requests.',
      });
      return;
    }

    // Bot permission check
    if (!channel.permissionsFor(client.user)?.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({
        content: `The bot does not have the \`Manage Roles\` permission.\nPlease try again after giving the bot this permission.`,
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
    const { infoEmbed, userId, createdAt, expireAt, roleId } = parsedResult;

    // Check if the recognized date is too far in the future
    const reasonableTimeLimit = createdAt.add(60, 'days');
    if (!expireAt) {
      await interaction.reply({
        content: 'The recognized date is invalid.\n' + 'Please set the correct date manually.',
      });
      return;
    } else if (expireAt.isAfter(reasonableTimeLimit)) {
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

    // Fetch role
    const role = await guild.roles.fetch(roleId, { force: true });
    if (!role) {
      return await replyInvalidRequest(
        interaction,
        `Failed to retrieve the role <@&${roleId}> from the guild.`,
      );
    }

    // Acknowledge the interaction
    await interaction.deferUpdate();

    // Fetch guild member
    let member: GuildMember | null = null;
    try {
      member = await guild.members.fetch({ user: userId, force: true });
    } catch (error) {
      console.error(error);
    }
    if (!member) {
      await interaction.followUp({
        content: `Failed to retrieve the member <@${userId}> from the guild.`,
      });
      return;
    }

    // Update database
    await UserCollection.findByIdAndUpdate(
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
    await MembershipCollection.findOneAndUpdate(
      {
        user: member.id,
        type: 'ocr',
        membershipRole: roleId,
      },
      {
        $set: {
          billingDate: expireAt.toDate(),
        },
        $setOnInsert: {
          type: 'ocr',
          user: member.id,
          membershipRole: roleId,
        },
      },
      {
        upsert: true,
        new: true,
      },
    );

    // Add role to member
    const botMember = await guild.members.fetchMe({ force: true });
    try {
      await member.roles.add(role);
    } catch (error) {
      console.error(error);
      await interaction.followUp({
        content: `Due to the role hierarchy, the bot cannot assign the role <@&${role.id}> to users.\nI can only assign a role whose order is lower than that of my highest role <@&${botMember.roles.highest.id}>.`,
      });
      return;
    }

    // DM the user
    let notified = false;
    try {
      await member.send({
        content: `You have been granted the membership role **@${role.name}** in the server \`${guild.name}\`.`,
      });
      notified = true;
    } catch (error) {
      // User does not allow DMs
    }

    // Mark the request as accepted
    const acceptedActionRow = createDisabledAcceptedActionRow();
    await interaction.message.edit({
      content: notified
        ? ''
        : "**[NOTE]** Due to the user's __Privacy Settings__ of this server, **I cannot send DM to notify them.**\nYou might need to notify them yourself.",
      embeds: [
        EmbedBuilder.from(infoEmbed.data)
          .setTitle('✅ [Accepted] ' + infoEmbed.title)
          .addFields([
            {
              name: 'Verified By',
              value: `<@${moderator.id}>`,
              inline: true,
            },
          ])
          .setColor('#57F287'),
      ],
      components: [acceptedActionRow],
    });
  },
});

export default membershipAcceptButton;
