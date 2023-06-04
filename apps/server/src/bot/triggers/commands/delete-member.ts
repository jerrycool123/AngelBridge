import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import utc from 'dayjs/plugin/utc.js';
import { SlashCommandBuilder } from 'discord.js';

import DBChecker from '../../../checkers/db.js';
import { MembershipService } from '../../../services/membership/index.js';
import {
  Bot,
  BotCommandTrigger,
  BotErrorConfig,
  GuildChatInputCommandInteraction,
} from '../../../types/bot.js';
import { BotEmbeds } from '../../components/embeds.js';
import { BotConfig } from '../../config.js';
import { BotCheckers, BotCommonUtils } from '../../utils/index.js';

dayjs.extend(utc);
dayjs.extend(customParseFormat);

export class DeleteMemberCommandTrigger implements BotCommandTrigger<true> {
  public readonly data = new SlashCommandBuilder()
    .setName('delete-member')
    .setDescription('Manually remove a YouTube membership role to from a member in this server')
    .setDefaultMemberPermissions(BotConfig.ModeratorPermissions)
    .addGenericUserOption('member', 'The member to remove the role from', true)
    .addGenericRoleOption('role', 'The YouTube Membership role in this server', true);
  public readonly guildOnly = true;
  public readonly botHasManageRolePermission = true;

  public async execute(
    bot: Bot,
    interaction: GuildChatInputCommandInteraction,
    errorConfig: BotErrorConfig,
  ): Promise<void> {
    const { guild, user: moderator, options } = interaction;

    await interaction.deferReply({ ephemeral: true });

    // Guild and log channel checks
    const { logChannel: logChannelId } = await DBChecker.requireGuildWithLogChannel(guild.id);
    const logChannel = await BotCheckers.requireGuildHasLogChannel(bot, guild, logChannelId);

    // Get membership role
    const role = options.getRole('role', true);
    await DBChecker.requireMembershipRoleWithYouTubeChannel(guild.id, role.id);

    const user = options.getUser('member', true);

    // Get the membership
    const membershipDoc = await DBChecker.requireMembershipWithGivenMembershipRole(
      user.id,
      role.id,
    );

    // Ask for confirmation
    const confirmButtonInteraction = await BotCommonUtils.awaitUserConfirm(
      interaction,
      'del-member',
      {
        content:
          `Are you sure you want to remove the membership role <@&${role.id}> from <@${user.id}>?\n` +
          'Please note that this does not block the user from applying for the membership again.',
      },
      errorConfig,
    );
    await confirmButtonInteraction.deferReply({ ephemeral: true });

    // Create membership service
    const guildOwner = await BotCheckers.fetchGuildOwner(guild, false);
    const membershipService = new MembershipService(bot, guild, guildOwner, logChannel);

    // Remove membership from user
    const notified = await membershipService.removeMembership({
      membershipDoc,
      membershipRoleData: membershipDoc.membershipRole,
      removeReason: 'it has been manually removed from the server by a moderator',
    });
    await confirmButtonInteraction.genericReply({
      content: `Successfully removed the membership role <@&${role.id}> from <@${user.id}>.`,
    });

    // Send log message
    const manualMembershipRemovalEmbed = BotEmbeds.createManualMembershipRemovalEmbed(
      user,
      role.id,
      moderator.id,
    );
    await logChannel.send({
      content: notified
        ? ''
        : "**[NOTE]** Due to the user's __Privacy Settings__ of this server, **I cannot send DM to notify them.**\nYou might need to notify them yourself.",
      embeds: [manualMembershipRemovalEmbed],
    });
  }
}
