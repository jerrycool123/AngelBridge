import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import utc from 'dayjs/plugin/utc.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import { CustomBotError } from '../../libs/error.js';
import MembershipCollection from '../../models/membership.js';
import DiscordBotConfig from '../config.js';
import { genericOption } from '../utils/common.js';
import awaitConfirm from '../utils/confirm.js';
import { useBotWithManageRolePermission, useGuildOnly } from '../utils/middleware.js';
import { botValidator } from '../utils/validator.js';
import CustomBotCommand from './index.js';

dayjs.extend(utc);
dayjs.extend(customParseFormat);

const del_member = new CustomBotCommand({
  data: new SlashCommandBuilder()
    .setName('del-member')
    .setDescription('Manually remove a YouTube membership role to from a member in this server')
    .setDefaultMemberPermissions(DiscordBotConfig.moderatorPermissions)
    .addUserOption(genericOption('member', 'The member to remove the role from', true))
    .addRoleOption(genericOption('role', 'The YouTube Membership role in this server', true)),
  execute: useGuildOnly(
    useBotWithManageRolePermission(async (interaction, errorConfig) => {
      const { guild, user: moderator, options } = interaction;

      await interaction.deferReply({ ephemeral: true });

      // Guild and log channel checks
      const guildDoc = await botValidator.requireGuildDocument(guild.id);
      const logChannelId = botValidator.requireGuildDocumentHasLogChannel(guildDoc);
      const logChannel = await botValidator.requireGuildHasLogChannel(guild, logChannelId);

      // Get membership role
      const role = options.getRole('role', true);
      await botValidator.requireMembershipRoleDocumentWithYouTubeChannel(role.id);

      // Get guild member
      const user = options.getUser('member', true);
      const member = await botValidator.requireGuildMember(guild, user.id);

      // Get the membership
      const membershipDoc = await botValidator.requireMembershipDocumentWithGivenMembershipRole(
        member.id,
        role.id,
      );

      // Ask for confirmation
      const confirmButtonInteraction = await awaitConfirm(
        interaction,
        'del-member',
        {
          content:
            `Are you sure you want to remove the membership role <@&${role.id}> from <@${member.id}>?\n` +
            'Please note that this does not block the user from applying for the membership again.',
        },
        errorConfig,
      );
      await confirmButtonInteraction.deferReply({ ephemeral: true });

      // Remove role from member
      const botMember = await guild.members.fetchMe({ force: true });
      try {
        await member.roles.remove(role.id);
      } catch (error) {
        console.error(error);
        errorConfig.activeInteraction = confirmButtonInteraction;
        throw new CustomBotError(
          `Due to the role hierarchy, the bot cannot remove the role <@&${role.id}> from users.\nI can only manage a role whose order is lower than that of my highest role <@&${botMember.roles.highest.id}>.`,
        );
      }
      await confirmButtonInteraction.editReply({
        content: `Successfully removed the membership role <@&${role.id}> from <@${member.id}>.`,
      });

      // Remove membership
      await MembershipCollection.findByIdAndDelete(membershipDoc._id);

      // DM the user
      let notified = false;
      try {
        await member.send({
          content: `Your membership role **@${role.name}** has been manually removed from the server \`${guild.name}\`.`,
        });
        notified = true;
      } catch (error) {
        // User does not allow DMs
      }

      // Send log message
      await logChannel.send({
        content: notified
          ? ''
          : "**[NOTE]** Due to the user's __Privacy Settings__ of this server, **I cannot send DM to notify them.**\nYou might need to notify them yourself.",
        embeds: [
          new EmbedBuilder()
            .setAuthor({
              name: `${user.username}#${user.discriminator}`,
              iconURL: user.displayAvatarURL(),
            })
            .setTitle('❌ Manual Membership Removal')
            .addFields([
              {
                name: 'Membership Role',
                value: `<@&${role.id}>`,
                inline: true,
              },
              {
                name: 'Removed By',
                value: `<@${moderator.id}>`,
                inline: true,
              },
            ])
            .setTimestamp()
            .setColor('#ED4245')
            .setFooter({ text: `User ID: ${user.id}` }),
        ],
      });
    }),
  ),
});

export default del_member;
