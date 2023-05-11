import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import utc from 'dayjs/plugin/utc.js';
import { EmbedBuilder, RepliableInteraction, SlashCommandBuilder } from 'discord.js';

import { CustomBotError } from '../../libs/error.js';
import MembershipCollection from '../../models/membership.js';
import DiscordBotConfig from '../config.js';
import { genericOption } from '../utils/common.js';
import awaitConfirm from '../utils/confirm.js';
import { upsertMembershipCollection } from '../utils/db.js';
import { useBotWithManageRolePermission, useGuildOnly } from '../utils/middleware.js';
import { botValidator } from '../utils/validator.js';
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
    useBotWithManageRolePermission(async (interaction, errorConfig) => {
      const { guild, user: moderator, options } = interaction;

      await interaction.deferReply({ ephemeral: true });

      // Guild and log channel checks
      const guildDoc = await botValidator.requireGuildDocument(guild.id);
      const logChannelId = botValidator.requireGuildDocumentHasLogChannel(guildDoc);
      const logChannel = await botValidator.requireGuildHasLogChannel(guild, logChannelId);

      // Get membership role and check if it's manageable
      const role = options.getRole('role', true);
      await botValidator.requireMembershipRoleDocumentWithYouTubeChannel(role.id);
      await botValidator.requireManageableRole(guild, role.id);

      // Get the next billing date
      let expireAt: dayjs.Dayjs;
      const billing_date = options.getString('billing_date');
      if (billing_date !== null) {
        expireAt = dayjs.utc(billing_date, 'YYYY/MM/DD', true);
        if (!expireAt.isValid()) {
          throw new CustomBotError(
            `The billing date \`${billing_date}\` is not a valid date in YYYY/MM/DD format.`,
          );
        }
        expireAt = expireAt.startOf('date');
      } else {
        expireAt = dayjs.utc().add(1, 'day').startOf('date');
      }

      // Check if the recognized date is too far in the future
      botValidator.requireGivenDateNotTooFarInFuture(expireAt);

      // Get guild member
      const user = options.getUser('member', true);
      const member = await botValidator.requireGuildMember(guild, user.id);

      // Check if the user already has OAuth membership
      const oauthMembershipDoc = await MembershipCollection.findOne({
        type: 'oauth',
        user: user.id,
        membershipRole: role.id,
      });
      let activeInteraction: RepliableInteraction = interaction;
      if (oauthMembershipDoc !== null) {
        activeInteraction = await awaitConfirm(
          activeInteraction,
          'add-member-detected-oauth',
          {
            content: `The user <@${user.id}> already has an OAuth membership. Do you want to overwrite it?`,
          },
          errorConfig,
        );
        await activeInteraction.deferReply({ ephemeral: true });
        errorConfig.activeInteraction = activeInteraction;
      }

      // Ask for confirmation
      const confirmButtonInteraction = await awaitConfirm(
        activeInteraction,
        'add-member',
        {
          content: `Are you sure you want to assign the membership role <@&${role.id}> to <@${
            member.id
          }>?\nTheir membership will expire on \`${expireAt.format('YYYY/MM/DD')}\`.`,
        },
        errorConfig,
      );
      await confirmButtonInteraction.deferReply({ ephemeral: true });

      // Add role to member
      try {
        await member.roles.add(role.id);
      } catch (error) {
        console.error(error);
        throw new CustomBotError('Failed to add the role to the member.');
      }
      await confirmButtonInteraction.editReply({
        content: `Successfully assigned the membership role <@&${role.id}> to <@${
          member.id
        }>.\nTheir membership will expire on \`${expireAt.format('YYYY/MM/DD')}\`.`,
      });

      // Create or update membership
      await upsertMembershipCollection({
        type: 'ocr',
        userId: member.id,
        membershipRoleId: role.id,
        expireAt,
      });

      // DM the user
      let notified = false;
      try {
        await member.send({
          content: `You have been manually granted the membership role **@${role.name}** in the server \`${guild.name}\`.`,
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
            .setTitle('✅ Manual Membership Assignment')
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
