import { ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

import { CustomBotError } from '../utils/bot-error.js';
import { createDisabledAcceptedActionRow } from '../utils/common.js';
import { upsertMembershipCollection } from '../utils/db.js';
import {
  invalidateMembershipVerificationEmbed,
  parseMembershipVerificationRequestEmbed,
} from '../utils/membership.js';
import {
  useBotWithManageRolePermission,
  useFollowUpCustomError,
  useGuildOnly,
  useUserWithManageRolePermission,
} from '../utils/middleware.js';
import { requireGivenDateNotTooFarInFuture, requireManageableRole } from '../utils/validator.js';
import { requireGuildMember } from '../utils/validator.js';
import CustomButton from './index.js';

const membershipAcceptButton = new CustomButton({
  customId: 'membership-accept',
  data: new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel('Accept'),
  execute: useFollowUpCustomError(
    useGuildOnly(
      useBotWithManageRolePermission(
        useUserWithManageRolePermission(async (interaction) => {
          const { guild, user: moderator } = interaction;

          await interaction.deferUpdate();

          // Parse embed
          const {
            infoEmbed,
            userId,
            expireAt: rawExpireAt,
            createdAt,
            roleId,
          } = await parseMembershipVerificationRequestEmbed(
            interaction,
            interaction.message.embeds[0] ?? null,
          );

          // Check if the recognized date is too far in the future
          const expireAt = requireGivenDateNotTooFarInFuture(interaction, rawExpireAt, createdAt);

          // Fetch role and check if it's manageable
          const role = await guild.roles.fetch(roleId, { force: true });
          if (role === null) {
            await invalidateMembershipVerificationEmbed(interaction);
            throw new CustomBotError(
              `Failed to retrieve the role <@&${roleId}> from the server.`,
              interaction,
            );
          }
          await requireManageableRole(interaction, guild, roleId);

          // Fetch guild member
          const member = await requireGuildMember(interaction, guild, userId);

          // Update membership in DB
          await upsertMembershipCollection({
            type: 'ocr',
            userId: member.id,
            membershipRoleId: roleId,
            expireAt,
          });

          // Add role to member
          try {
            await member.roles.add(role);
          } catch (error) {
            console.error(error);
            throw new CustomBotError('Failed to add the role to the member.', interaction);
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
                .setTitle('✅ [Accepted] ' + (infoEmbed.title ?? ''))
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
        }),
      ),
    ),
  ),
});

export default membershipAcceptButton;
