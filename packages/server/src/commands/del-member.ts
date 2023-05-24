import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import utc from 'dayjs/plugin/utc.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import BotChecker from '../checkers/bot.js';
import DBChecker from '../checkers/db.js';
import DiscordBotConfig from '../config.js';
import { fetchGuildOwner, removeUserMembership } from '../libs/membership.js';
import { genericOption } from '../utils/common.js';
import awaitConfirm from '../utils/confirm.js';
import { useBotWithManageRolePermission, useGuildOnly } from '../utils/middleware.js';
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
      const { logChannel: logChannelId } = await DBChecker.requireGuildWithLogChannel(guild.id);
      const logChannel = await BotChecker.requireGuildHasLogChannel(guild, logChannelId);

      // Get membership role
      const role = options.getRole('role', true);
      await DBChecker.requireMembershipRoleWithYouTubeChannel(role.id);

      // Get guild member and owner
      const user = options.getUser('member', true);
      const member = await BotChecker.requireGuildMember(guild, user.id, false);
      const guildOwner = await fetchGuildOwner(guild, false);

      // Get the membership
      const membershipDoc = await DBChecker.requireMembershipWithGivenMembershipRole(
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
      const notified = await removeUserMembership({
        membershipDoc,
        membershipRoleData: membershipDoc.membershipRole,
        removeReason: 'it has been manually removed from the server by a moderator',
        guild,
        guildOwner,
        logChannel,
      });
      await confirmButtonInteraction.editReply({
        content: `Successfully removed the membership role <@&${role.id}> from <@${member.id}>.`,
      });

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
