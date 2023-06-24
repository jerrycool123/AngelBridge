import { SlashCommandBuilder } from 'discord.js';

import DBChecker from '../../../checkers/db.js';
import MembershipRoleCollection from '../../../models/membership-role.js';
import MembershipCollection, { MembershipDoc } from '../../../models/membership.js';
import { YouTubeChannelDoc } from '../../../models/youtube-channel.js';
import { MembershipService } from '../../../services/membership/service.js';
import {
  Bot,
  BotCommandTrigger,
  BotErrorConfig,
  GuildChatInputCommandInteraction,
} from '../../../types/bot.js';
import { NotFoundError } from '../../../utils/error.js';
import { BotConstants } from '../../constants.js';
import { BotCheckers, BotCommonUtils } from '../../utils/index.js';

export class DeleteRoleCommandTrigger implements BotCommandTrigger<true> {
  public readonly data = new SlashCommandBuilder()
    .setName('delete-role')
    .setDescription('Delete a YouTube membership role in this server')
    .setDefaultMemberPermissions(BotConstants.ModeratorPermissions)
    .addGenericRoleOption('role', 'The YouTube Membership role in this server', true);
  public readonly guildOnly = true;
  public readonly botHasManageRolePermission = true;

  public async execute(
    bot: Bot<true>,
    interaction: GuildChatInputCommandInteraction,
    errorConfig: BotErrorConfig,
  ): Promise<void> {
    const { guild, options } = interaction;

    await interaction.deferReply({ ephemeral: true });

    // Guild and log channel checks
    const { logChannel: logChannelId } = await DBChecker.requireGuildWithLogChannel(guild.id);
    const logChannel = await BotCheckers.requireGuildHasLogChannel(bot, guild, logChannelId);

    // Check if the role is manageable
    const role = options.getRole('role', true);
    await BotCheckers.requireManageableRole(guild, role.id);

    // Find membership role and members with the role in DB
    const [membershipRoleDoc, membershipDocs] = await Promise.all([
      MembershipRoleCollection.findById(role.id)
        .populate<{
          youTubeChannel: YouTubeChannelDoc | null;
        }>('youTubeChannel')
        .orFail(
          new NotFoundError(
            `The role <@&${role.id}> is not a membership role in this server.\n` +
              'You can use `/settings` to see the list of membership roles in this server.',
          ),
        ),
      MembershipCollection.find<MembershipDoc>({
        membershipRole: role.id,
      }),
    ]);

    // Ask for confirmation
    const confirmButtonInteraction = await BotCommonUtils.awaitUserConfirm(
      interaction,
      'delete-role',
      {
        content:
          `Are you sure you want to delete the membership role <@&${
            role.id
          }> for the YouTube channel \`${
            membershipRoleDoc.youTubeChannel?.title ?? '[Unknown Channel]'
          }\`?\n` +
          `This action will remove the membership role from ${membershipDocs.length} members.\n\n` +
          `Note that we won't delete the role in Discord. Instead, we just delete the membership role in the database, and remove the role from registered members.`,
      },
      errorConfig,
    );
    errorConfig.activeInteraction = confirmButtonInteraction;
    await confirmButtonInteraction.deferReply({ ephemeral: true });

    // Initialize membership service
    const membershipService = new MembershipService(bot);
    await membershipService.initEventLog(guild, null, logChannel);

    // Remove membership role from DB
    await membershipService.removeMembershipRole({
      membershipDocGroup: membershipDocs,
      membershipRoleId: membershipRoleDoc._id,
      removeReason: `the membership role has been deleted by a moderator in the server \`${guild.name}\``,
    });

    await confirmButtonInteraction.genericReply({
      content: `Successfully deleted the membership role <@&${role.id}> for the YouTube channel \`${
        membershipRoleDoc.youTubeChannel?.title ?? '[Unknown Channel]'
      }\`.`,
    });
  }
}
