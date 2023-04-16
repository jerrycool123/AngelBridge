import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { youtube_v3 } from 'googleapis';

import { youtubeApi } from '../../libs/google.js';
import DiscordBotConfig from '../config.js';
import { genericOption } from '../utils/common.js';
import awaitConfirm from '../utils/confirm.js';
import { upsertYouTubeChannelCollection } from '../utils/db.js';
import { CustomError } from '../utils/error.js';
import { useGuildOnly } from '../utils/validator.js';
import CustomBotCommand from './index.js';

const add_yt_channel = new CustomBotCommand({
  data: new SlashCommandBuilder()
    .setName('add-yt-channel')
    .setDescription("Add a YouTube channel to the bot's supported list.")
    .setDefaultMemberPermissions(DiscordBotConfig.moderatorPermissions)
    .addStringOption(genericOption('id', 'YouTube channel ID or video ID', true)),
  execute: useGuildOnly(async (interaction) => {
    const { user, options } = interaction;

    await interaction.deferReply({ ephemeral: true });

    // Search YouTube channel by ID via YouTube API
    let channelId: string;
    const id = options.getString('id', true);
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
      if (!videoChannelId) {
        throw new CustomError(
          `Could not find a YouTube video for the video ID: \`${id}\`. Please try again. Here are some examples:\n\n` +
            `The channel ID of <https://www.youtube.com/channel/UCZlDXzGoo7d44bwdNObFacg> is \`UCZlDXzGoo7d44bwdNObFacg\`. It must begins with 'UC...'. Currently we don't support custom channel ID search (e.g. \`@AmaneKanata\`). If you cannot find a valid channel ID, please provide a video ID instead.\n\n` +
            `The video ID of <https://www.youtube.com/watch?v=Dji-ehIz5_k> is \`Dji-ehIz5_k\`.`,
          interaction,
        );
      } else {
        channelId = videoChannelId;
      }
    }

    // Get channel info from YouTube API
    let channel: youtube_v3.Schema$Channel | undefined = undefined;
    try {
      const response = await youtubeApi.channels.list({ part: ['snippet'], id: [channelId] });
      channel = response.data.items?.[0];
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
      throw new CustomError(
        `Could not find a YouTube channel for the channel ID: \`${channelId}\`. Please try again.`,
        interaction,
      );
    }
    const channelInfo = { id: youTubeChannelId, title, description, customUrl, thumbnail };

    // Ask for confirmation
    const confirmButtonInteraction = await awaitConfirm(interaction, 'add-yt-channel', {
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
    });

    // Add YouTube channel to database
    await confirmButtonInteraction.deferReply({ ephemeral: true });
    const youTubeChannelDoc = await upsertYouTubeChannelCollection(channelInfo);

    await confirmButtonInteraction.editReply({
      content: `Successfully added the YouTube channel \`${youTubeChannelDoc.title}\` to the bot's supported list.`,
    });
  }),
});

export default add_yt_channel;
