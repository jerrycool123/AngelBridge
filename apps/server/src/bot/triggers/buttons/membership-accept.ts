import { EmbedBuilder } from 'discord.js';

import CommonChecker from '../../../checkers/common.js';
import {
  Bot,
  BotButtonTrigger,
  BotErrorConfig,
  GuildButtonInteraction,
} from '../../../types/bot.js';
import { DBUtils } from '../../../utils/db.js';
import { InternalServerError, NotFoundError } from '../../../utils/error.js';
import { BotActionRows, BotEmbeds } from '../../components/index.js';
import { BotConfig } from '../../config.js';
import { BotCheckers } from '../../utils/index.js';

export class MembershipAcceptButtonTrigger implements BotButtonTrigger<true> {
  public readonly customId = BotConfig.AdminMembershipVerificationActionId.accept;
  public readonly guildOnly = true;
  public readonly botHasManageRolePermission = true;
  public readonly userHasManageRolePermission = true;

  public async execute(
    bot: Bot,
    interaction: GuildButtonInteraction,
    errorConfig: BotErrorConfig,
  ): Promise<void> {
    errorConfig.followUp = true;
    const { guild, user: moderator } = interaction;

    await interaction.deferUpdate();

    // Parse embed
    const {
      infoEmbed,
      userId,
      expireAt: rawExpireAt,
      createdAt,
      roleId,
    } = await BotEmbeds.parseMembershipVerificationRequestEmbed(
      interaction,
      interaction.message.embeds[0] ?? null,
      errorConfig,
    );

    // Check if the recognized date is too far in the future
    const expireAt = CommonChecker.requireGivenDateNotTooFarInFuture(rawExpireAt, createdAt);

    // Fetch role and check if it's manageable
    const role = await BotCheckers.fetchRole(guild, roleId);
    if (role === null) {
      throw new NotFoundError(`Failed to retrieve the role <@&${roleId}> from the server.`);
    }
    await BotCheckers.requireManageableRole(guild, roleId);

    // Fetch guild member
    const member = await BotCheckers.fetchGuildMember(guild, userId, false);
    if (member === null) {
      throw new NotFoundError(`The user <@${userId}> is not a member of the server.`);
    }

    // Update membership in DB
    await DBUtils.upsertMembership({
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
      throw new InternalServerError('Failed to add the role to the member.');
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
    const acceptedActionRow = BotActionRows.createDisabledAccepted();
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
  }
}
