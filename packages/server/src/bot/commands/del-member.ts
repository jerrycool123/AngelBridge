import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import utc from 'dayjs/plugin/utc.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import MembershipCollection from '../../models/membership.js';
import DiscordBotConfig from '../config.js';
import { genericOption } from '../utils/common.js';
import awaitConfirm from '../utils/confirm.js';
import { CustomError } from '../utils/error.js';
import { useBotWithManageRolePermission, useGuildOnly } from '../utils/middleware.js';
import {
  requireGuildDocumentAllowOCR,
  requireGuildDocumentHasLogChannel,
  requireGuildHasLogChannel,
  requireGuildMember,
  requireMembershipRoleDocumentWithYouTubeChannel,
  requireOCRMembershipDocumentWithGivenMembershipRole,
  requiredGuildDocument,
} from '../utils/validator.js';
import CustomBotCommand from './index.js';

dayjs.extend(utc);
dayjs.extend(customParseFormat);

const del_member = new CustomBotCommand({
  data: new SlashCommandBuilder()
    .setName('del-member')
    .setDescription(
      'Manually remove a YouTube membership role to from member in this server in OCR mode',
    )
    .setDefaultMemberPermissions(DiscordBotConfig.moderatorPermissions)
    .addUserOption(genericOption('member', 'The member to remove the role from', true))
    .addRoleOption(genericOption('role', 'The YouTube Membership role in this server', true)),
  execute: useGuildOnly(
    useBotWithManageRolePermission(async (interaction) => {
      const { guild, user: moderator, options } = interaction;

      await interaction.deferReply({ ephemeral: true });

      // Guild and log channel checks
      const guildDoc = await requiredGuildDocument(interaction, guild);
      requireGuildDocumentAllowOCR(interaction, guildDoc);
      const logChannelId = requireGuildDocumentHasLogChannel(interaction, guildDoc);
      const logChannel = await requireGuildHasLogChannel(interaction, guild, logChannelId);

      // Get membership role
      const role = options.getRole('role', true);
      await requireMembershipRoleDocumentWithYouTubeChannel(interaction, role.id);

      // Get guild member
      const user = options.getUser('member', true);
      const member = await requireGuildMember(interaction, guild, user.id);

      // Get the membership
      const membershipDoc = await requireOCRMembershipDocumentWithGivenMembershipRole(
        interaction,
        member.id,
        role.id,
      );

      // Ask for confirmation
      const confirmButtonInteraction = await awaitConfirm(interaction, 'del-member', {
        content: `Are you sure you want to remove the membership role <@&${role.id}> from <@${member.id}>?`,
      });
      await confirmButtonInteraction.deferReply({ ephemeral: true });

      // Remove role from member
      const botMember = await guild.members.fetchMe({ force: true });
      try {
        await member.roles.remove(role.id);
      } catch (error) {
        console.error(error);
        throw new CustomError(
          `Due to the role hierarchy, the bot cannot remove the role <@&${role.id}> from users.\nI can only manage a role whose order is lower than that of my highest role <@&${botMember.roles.highest.id}>.`,
          confirmButtonInteraction,
        );
      }
      await confirmButtonInteraction.editReply({
        content: `Successfully removed the membership role <@&${role.id}> from <@${member.id}>.`,
      });

      // Remove membership
      await MembershipCollection.findByIdAndDelete(membershipDoc._id);

      // Send log message
      await logChannel.send({
        embeds: [
          new EmbedBuilder()
            .setAuthor({
              name: `${user.username}#${user.discriminator}`,
              iconURL: user.displayAvatarURL(),
            })
            .setTitle('❌ [Removed] Manual Membership Verification')
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
