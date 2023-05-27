import { SlashCommandBuilder } from 'discord.js';

import { BotChecker } from '../../checkers/bot.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../libs/error.js';
import MembershipRoleCollection from '../../models/membership-role.js';
import YouTubeChannelCollection, { YouTubeChannelDoc } from '../../models/youtube-channel.js';
import { BotCommand, BotErrorConfig, GuildChatInputCommandInteraction } from '../../types/bot.js';
import { BotConstants } from '../constants.js';
import { genericOption } from '../utils/common.js';
import awaitConfirmButtonInteraction from '../utils/confirm.js';

export class AddRoleCommand implements BotCommand<true> {
  public readonly data = new SlashCommandBuilder()
    .setName('add-role')
    .setDescription('Add a YouTube membership role in this server')
    .setDefaultMemberPermissions(BotConstants.ModeratorPermissions)
    .addRoleOption(genericOption('role', 'The YouTube Membership role in this server', true))
    .addStringOption(
      genericOption('keyword', "The YouTube channel's ID, name or custom URL", true),
    );
  public readonly guildOnly = true;
  public readonly botHasManageRolePermission = true;

  public async execute(
    interaction: GuildChatInputCommandInteraction,
    errorConfig: BotErrorConfig,
  ): Promise<void> {
    const { guild, options } = interaction;

    await interaction.deferReply({ ephemeral: true });

    // Check if the role is manageable
    const role = options.getRole('role', true);
    await BotChecker.requireManageableRole(guild, role.id);

    // Search registered YouTube channel by keyword
    const keyword = options.getString('keyword', true);
    const youTubeChannelDocs = await YouTubeChannelCollection.find({
      $or: [
        { _id: { $regex: keyword, $options: 'i' } },
        { title: { $regex: keyword, $options: 'i' } },
        { customUrl: { $regex: keyword, $options: 'i' } },
      ],
    });
    if (youTubeChannelDocs.length === 0) {
      throw new NotFoundError(
        `Could not find any registered YouTube channel for the keyword: \`${keyword}\`.\n` +
          'Please try again or use `/add-yt-channel` to register the channel first.',
      );
    } else if (youTubeChannelDocs.length > 1) {
      throw new BadRequestError(
        `Found multiple registered YouTube channels for the keyword: \`${keyword}\`.\n` +
          'Please try again with a more specific keyword.\n\n' +
          'Found channels:\n' +
          youTubeChannelDocs
            .map((channel) => `\`${channel.title}\`: \`${channel._id}\` (\`${channel.customUrl}\`)`)
            .join('\n'),
      );
    }
    const youTubeChannel = youTubeChannelDocs[0];

    // Check if the role is already assigned to the channel
    const oldMembershipRoleDoc = await MembershipRoleCollection.findOne({
      $or: [{ _id: role.id }, { youTubeChannel: youTubeChannel._id }],
    }).populate<{
      youTubeChannel: YouTubeChannelDoc | null;
    }>('youTubeChannel');
    if (oldMembershipRoleDoc !== null) {
      throw new ConflictError(
        `The membership role <@&${
          oldMembershipRoleDoc._id
        }> is already assigned to the YouTube channel \`${
          oldMembershipRoleDoc.youTubeChannel?.title ?? '[Unknown Channel]'
        }\`.`,
      );
    }

    // Ask for confirmation
    const confirmButtonInteraction = await awaitConfirmButtonInteraction(
      interaction,
      'add-role',
      {
        content: `Are you sure you want to add the membership role <@&${role.id}> for the YouTube channel \`${youTubeChannel.title}\`?`,
      },
      errorConfig,
    );
    await confirmButtonInteraction.deferReply({ ephemeral: true });

    // Link the role to YouTube membership and save to DB
    const newMembershipRoleDoc = await MembershipRoleCollection.build({
      _id: role.id,
      name: role.name,
      color: role.color,
      guild: guild.id,
      youTubeChannel: youTubeChannel._id,
    });
    const populatedNewMembershipRoleDoc = await MembershipRoleCollection.populate<{
      youTubeChannel: YouTubeChannelDoc | null;
    }>(newMembershipRoleDoc, 'youTubeChannel');
    await confirmButtonInteraction.editReply({
      content: `Successfully added the membership role <@&${
        populatedNewMembershipRoleDoc._id
      }> for the YouTube channel \`${
        populatedNewMembershipRoleDoc.youTubeChannel?.title ?? '[Unknown Channel]'
      }\`.`,
    });
  }
}
