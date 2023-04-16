import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import utc from 'dayjs/plugin/utc.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import DiscordBotConfig from '../config.js';
import {
  requireGivenDateNotTooFarInFuture,
  requireGuildDocumentAllowOCR,
  requireGuildDocumentHasLogChannel,
  requireGuildHasLogChannel,
  requireGuildMember,
  requireMembershipRoleDocumentWithYouTubeChannel,
  requiredGuildDocument,
} from '../utils/checker.js';
import { genericOption } from '../utils/common.js';
import awaitConfirm from '../utils/confirm.js';
import { upsertOCRMembershipCollection } from '../utils/db.js';
import { CustomError } from '../utils/error.js';
import { useBotWithManageRolePermission, useGuildOnly } from '../utils/validator.js';
import CustomBotCommand from './index.js';

dayjs.extend(utc);
dayjs.extend(customParseFormat);

const add_member = new CustomBotCommand({
  data: new SlashCommandBuilder()
    .setName('add-member')
    .setDescription(
      'Manually assign a YouTube membership role to a member in this server in OCR mode',
    )
    .setDefaultMemberPermissions(DiscordBotConfig.moderatorPermissions)
    .addUserOption(genericOption('member', 'The member to assign the role to', true))
    .addRoleOption(genericOption('role', 'The YouTube Membership role in this server', true))
    .addStringOption(
      genericOption(
        'billing_date',
        'The next billing date of the member in YYYY/MM/DD, default to tomorrow',
      ),
    ),
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

      // Get the next billing date
      let expireAt: dayjs.Dayjs;
      const billing_date = options.getString('billing_date');
      if (billing_date) {
        expireAt = dayjs.utc(billing_date, 'YYYY/MM/DD', true);
        if (!expireAt.isValid()) {
          throw new CustomError(
            `The billing date \`${billing_date}\` is not a valid date in YYYY/MM/DD format.`,
            interaction,
          );
        }
        expireAt = expireAt.startOf('date');
      } else {
        expireAt = dayjs.utc().add(1, 'day').startOf('date');
      }

      // Check if the recognized date is too far in the future
      requireGivenDateNotTooFarInFuture(interaction, expireAt);

      // Get guild member
      const user = options.getUser('member', true);
      const member = await requireGuildMember(interaction, guild, user.id);

      // Ask for confirmation
      const confirmButtonInteraction = await awaitConfirm(interaction, 'add-member', {
        content: `Are you sure you want to assign the membership role <@&${role.id}> to <@${
          member.id
        }>?\nTheir membership will expire on \`${expireAt.format('YYYY/MM/DD')}\`.`,
      });
      await confirmButtonInteraction.deferReply({ ephemeral: true });

      // Add role to member
      const botMember = await guild.members.fetchMe({ force: true });
      try {
        await member.roles.add(role.id);
      } catch (error) {
        console.error(error);
        throw new CustomError(
          `Due to the role hierarchy, the bot cannot assign the role <@&${role.id}> to users.\nI can only manage a role whose order is lower than that of my highest role <@&${botMember.roles.highest.id}>.`,
          confirmButtonInteraction,
        );
      }
      await confirmButtonInteraction.editReply({
        content: `Successfully assigned the membership role <@&${role.id}> to <@${
          member.id
        }>.\nTheir membership will expire on \`${expireAt.format('YYYY/MM/DD')}\`.`,
      });

      // Create or update membership
      await upsertOCRMembershipCollection({
        userId: member.id,
        membershipRoleId: role.id,
        expireAt,
      });

      // Send log message
      await logChannel.send({
        embeds: [
          new EmbedBuilder()
            .setAuthor({
              name: `${user.username}#${user.discriminator}`,
              iconURL: user.displayAvatarURL(),
            })
            .setTitle('✅ [Accepted] Manual Membership Verification')
            .addFields([
              {
                name: 'Expiration Date',
                value: expireAt.format('YYYY/MM/DD'),
                inline: true,
              },
              {
                name: 'Membership Role',
                value: `<@&${role.id}>`,
                inline: true,
              },
              {
                name: 'Assigned By',
                value: `<@${moderator.id}>`,
                inline: true,
              },
            ])
            .setTimestamp()
            .setColor('#57F287')
            .setFooter({ text: `User ID: ${user.id}` }),
        ],
      });
    }),
  ),
});

export default add_member;
