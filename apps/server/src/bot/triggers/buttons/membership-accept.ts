import { EmbedBuilder } from 'discord.js';

import CommonChecker from '../../../checkers/common.js';
import { MembershipService } from '../../../services/membership/service.js';
import {
  Bot,
  BotButtonTrigger,
  BotErrorConfig,
  GuildButtonInteraction,
} from '../../../types/bot.js';
import { NotFoundError } from '../../../utils/error.js';
import { BotActionRows, BotEmbeds } from '../../components/index.js';
import { BotConstants } from '../../constants.js';
import { BotCheckers } from '../../utils/index.js';

export class MembershipAcceptButtonTrigger implements BotButtonTrigger<true> {
  public readonly customId = BotConstants.AdminMembershipVerificationActionId.accept;
  public readonly guildOnly = true;
  public readonly botHasManageRolePermission = true;
  public readonly userHasManageRolePermission = true;

  public async execute(
    bot: Bot<true>,
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

    // Initialize membership service
    const membershipService = new MembershipService(bot);
    await membershipService.initEventLog(guild, null, null);

    // Add membership to user
    const { notified } = await membershipService.addMembership({
      member,
      membership: {
        type: 'ocr',
        expireAt,
      },
      guild,
      membershipRole: role,
    });

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
