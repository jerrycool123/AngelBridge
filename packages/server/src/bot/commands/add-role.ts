import { SlashCommandBuilder } from 'discord.js';

import MembershipRoleCollection from '../../models/membership-role.js';
import YouTubeChannelCollection, { YouTubeChannelDoc } from '../../models/youtube-channel.js';
import DiscordBotConfig from '../config.js';
import { requireManageableRole } from '../utils/checker.js';
import { genericOption } from '../utils/common.js';
import awaitConfirmButtonInteraction from '../utils/confirm.js';
import { CustomError } from '../utils/error.js';
import { useBotWithManageRolePermission, useGuildOnly } from '../utils/middleware.js';
import CustomBotCommand from './index.js';

const add_role = new CustomBotCommand({
  data: new SlashCommandBuilder()
    .setName('add-role')
    .setDescription('Add a YouTube membership role in this server')
    .setDefaultMemberPermissions(DiscordBotConfig.moderatorPermissions)
    .addRoleOption(genericOption('role', 'The YouTube Membership role in this server', true))
    .addStringOption(
      genericOption('keyword', "The YouTube channel's ID, name or custom URL", true),
    ),
  execute: useGuildOnly(
    useBotWithManageRolePermission(async (interaction) => {
      const { guild, options } = interaction;

      await interaction.deferReply({ ephemeral: true });

      // Check if the role is manageable
      const role = options.getRole('role', true);
      await requireManageableRole(interaction, guild, role.id);

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
        throw new CustomError(
          `Could not find any registered YouTube channel for the keyword: \`${keyword}\`.\n` +
            'Please try again or use `/add-yt-channel` to register the channel first.',
          interaction,
        );
      } else if (youTubeChannelDocs.length > 1) {
        throw new CustomError(
          `Found multiple registered YouTube channels for the keyword: \`${keyword}\`.\n` +
            'Please try again with a more specific keyword.\n\n' +
            'Found channels:\n' +
            youTubeChannelDocs
              .map(
                (channel) => `\`${channel.title}\`: \`${channel._id}\` (\`${channel.customUrl}\`)`,
              )
              .join('\n'),
          interaction,
        );
      }
      const youTubeChannel = youTubeChannelDocs[0];

      // Check if the role is already assigned to the channel
      const oldMembershipRoleDoc = await MembershipRoleCollection.findOne({
        $or: [{ _id: role.id }, { youTubeChannel: youTubeChannel._id }],
      }).populate<{
        youTubeChannel: YouTubeChannelDoc;
      }>('youTubeChannel');
      if (oldMembershipRoleDoc) {
        throw new CustomError(
          `The membership role <@&${oldMembershipRoleDoc.id}> is already assigned to the YouTube channel \`${oldMembershipRoleDoc.youTubeChannel.title}\`.`,
          interaction,
        );
      }

      // Ask for confirmation
      const confirmButtonInteraction = await awaitConfirmButtonInteraction(
        interaction,
        'add-role',
        {
          content: `Are you sure you want to add the membership role <@&${role.id}> for the YouTube channel \`${youTubeChannel.title}\`?`,
        },
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
        youTubeChannel: YouTubeChannelDoc;
      }>(newMembershipRoleDoc, 'youTubeChannel');
      await confirmButtonInteraction.editReply({
        content: `Successfully added the membership role <@&${populatedNewMembershipRoleDoc._id}> for the YouTube channel \`${populatedNewMembershipRoleDoc.youTubeChannel.title}\`.`,
      });
    }),
  ),
});

export default add_role;
