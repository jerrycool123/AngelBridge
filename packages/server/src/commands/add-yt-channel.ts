import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { google, youtube_v3 } from 'googleapis';

import DiscordBotConfig from '../config.js';
import { NotFoundError } from '../libs/error.js';
import GoogleAPI from '../libs/google.js';
import { genericOption } from '../utils/common.js';
import awaitConfirm from '../utils/confirm.js';
import { upsertYouTubeChannelCollection } from '../utils/db.js';
import { useGuildOnly } from '../utils/middleware.js';
import CustomBotCommand from './index.js';

const add_yt_channel = new CustomBotCommand({
  data: new SlashCommandBuilder()
    .setName('add-yt-channel')
    .setDescription("Add a YouTube channel to the bot's supported list.")
    .setDefaultMemberPermissions(DiscordBotConfig.moderatorPermissions)
    .addStringOption(genericOption('id', 'YouTube channel ID or video ID', true)),
  execute: useGuildOnly(async (interaction, errorConfig) => {
    const { user, options } = interaction;

    await interaction.deferReply({ ephemeral: true });

    // Search YouTube channel by ID via YouTube API
    let channelId: string;
    const id = options.getString('id', true);
    const youtubeApi = google.youtube({ version: 'v3', auth: GoogleAPI.key });
    if (id.startsWith('UC') && id.length === 24) {
      // Channel ID
      channelId = id;
    } else {
      // Video ID
      let videoChannelId: string | null | undefined = undefined;
      try {
        const response = await youtubeApi.videos.list({ part: ['snippet'], id: [id] });
        videoChannelId = response.data.items?.[0]?.snippet?.channelId;
      } catch (error) {
        console.error(error);
      }
      if (videoChannelId == null) {
        throw new NotFoundError(
          `Could not find a YouTube video for the video ID: \`${id}\`. Please try again. Here are some examples:\n\n` +
            `The channel ID of <https://www.youtube.com/channel/UCZlDXzGoo7d44bwdNObFacg> is \`UCZlDXzGoo7d44bwdNObFacg\`. It must begins with 'UC...'. Currently we don't support custom channel ID search (e.g. \`@AmaneKanata\`). If you cannot find a valid channel ID, please provide a video ID instead.\n\n` +
            `The video ID of <https://www.youtube.com/watch?v=Dji-ehIz5_k> is \`Dji-ehIz5_k\`.`,
        );
      } else {
        channelId = videoChannelId;
      }
    }

    // Get channel info from YouTube API
    let channel: youtube_v3.Schema$Channel | null = null;
    try {
      const response = await youtubeApi.channels.list({ part: ['snippet'], id: [channelId] });
      channel = response.data.items?.[0] ?? null;
    } catch (error) {
      console.error(error);
    }
    const [youTubeChannelId, title, description, customUrl, thumbnail] = [
      channel?.id,
      channel?.snippet?.title,
      channel?.snippet?.description,
      channel?.snippet?.customUrl,
      channel?.snippet?.thumbnails?.default?.url,
    ];
    if (
      youTubeChannelId == null ||
      title == null ||
      description == null ||
      customUrl == null ||
      thumbnail == null
    ) {
      throw new NotFoundError(
        `Could not find a YouTube channel for the channel ID: \`${channelId}\`. Please try again.`,
      );
    }
    const channelInfo = { id: youTubeChannelId, title, description, customUrl, thumbnail };

    // Ask for confirmation
    const confirmButtonInteraction = await awaitConfirm(
      interaction,
      'add-yt-channel',
      {
        content:
          "Are you sure you want to add the following YouTube channel to the bot's supported list?",
        embeds: [
          new EmbedBuilder()
            .setAuthor({
              name: `${user.username}#${user.discriminator}`,
              iconURL: user.displayAvatarURL(),
            })
            .setTitle(channelInfo.title)
            .setDescription(channelInfo.description)
            .setURL(`https://www.youtube.com/channel/${channelInfo.id}`)
            .setThumbnail(channelInfo.thumbnail)
            .addFields([
              {
                name: 'Channel ID',
                value: channelInfo.id,
                inline: true,
              },
              {
                name: 'Custom URL',
                value: `[${channelInfo.customUrl}](https://www.youtube.com/${channelInfo.customUrl})`,
                inline: true,
              },
            ])
            .setTimestamp()
            .setColor('Random')
            .setFooter({ text: `ID: ${user.id}` }),
        ],
      },
      errorConfig,
    );
    await confirmButtonInteraction.deferReply({ ephemeral: true });

    // Fetch member only video IDs
    const memberOnlyVideoIds: string[] = [];
    try {
      const memberOnlyPlaylistId = 'UUMO' + youTubeChannelId.slice(2);
      const { data } = await youtubeApi.playlistItems.list({
        part: ['contentDetails'],
        playlistId: memberOnlyPlaylistId,
        maxResults: 20,
      });
      data.items?.forEach((item) => {
        if (item.contentDetails?.videoId != null) {
          memberOnlyVideoIds.push(item.contentDetails.videoId);
        }
      });
    } catch (error) {
      console.error(error);
    }
    if (memberOnlyVideoIds.length === 0) {
      errorConfig.activeInteraction = confirmButtonInteraction;
      throw new NotFoundError(
        `Could not find any member only videos for the YouTube channel: \`${channelInfo.title}\`. Please try again.`,
      );
    }

    // Add YouTube channel to database
    const youTubeChannelDoc = await upsertYouTubeChannelCollection(channelInfo, memberOnlyVideoIds);

    await confirmButtonInteraction.editReply({
      content: `Successfully added the YouTube channel \`${youTubeChannelDoc.title}\` to the bot's supported list.`,
    });
  }),
});

export default add_yt_channel;
