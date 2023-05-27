import { SlashCommandBuilder } from 'discord.js';

import { BotChecker } from '../../checkers/bot.js';
import DBChecker from '../../checkers/db.js';
import { NotFoundError } from '../../libs/error.js';
import { fetchGuildOwner, removeMembershipRole } from '../../libs/membership.js';
import MembershipRoleCollection from '../../models/membership-role.js';
import MembershipCollection, { MembershipDoc } from '../../models/membership.js';
import { YouTubeChannelDoc } from '../../models/youtube-channel.js';
import { BotCommand, BotErrorConfig, GuildChatInputCommandInteraction } from '../../types/bot.js';
import { BotConstants } from '../constants.js';
import { genericOption } from '../utils/common.js';
import awaitConfirm from '../utils/confirm.js';

export class DeleteRoleCommand implements BotCommand<true> {
  public readonly data = new SlashCommandBuilder()
    .setName('delete-role')
    .setDescription('Delete a YouTube membership role in this server')
    .setDefaultMemberPermissions(BotConstants.ModeratorPermissions)
    .addRoleOption(genericOption('role', 'The YouTube Membership role in this server', true));
  public readonly guildOnly = true;
  public readonly botHasManageRolePermission = true;

  public async execute(
    interaction: GuildChatInputCommandInteraction,
    errorConfig: BotErrorConfig,
  ): Promise<void> {
    const { guild, options } = interaction;

    await interaction.deferReply({ ephemeral: true });

    // Guild and log channel checks
    const { logChannel: logChannelId } = await DBChecker.requireGuildWithLogChannel(guild.id);
    const logChannel = await BotChecker.requireGuildHasLogChannel(guild, logChannelId);

    // Check if the role is manageable
    const role = options.getRole('role', true);
    await BotChecker.requireManageableRole(guild, role.id);

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
    const confirmButtonInteraction = await awaitConfirm(
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
    await confirmButtonInteraction.deferReply({ ephemeral: true });

    // Get guild owner and log channel
    const guildOwner = await fetchGuildOwner(guild, false);

    // Remove membership role from DB
    await removeMembershipRole({
      membershipDocGroup: membershipDocs,
      membershipRoleId: membershipRoleDoc._id,
      removeReason: `the membership role has been deleted by a moderator in the server \`${guild.name}\``,
      guild,
      guildOwner,
      logChannel,
    });

    await confirmButtonInteraction.editReply({
      content: `Successfully deleted the membership role <@&${role.id}> for the YouTube channel \`${
        membershipRoleDoc.youTubeChannel?.title ?? '[Unknown Channel]'
      }\`.`,
    });
  }
}
