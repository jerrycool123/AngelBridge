import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CacheType,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { youtube_v3 } from 'googleapis';

import { genericOption } from '../../libs/discord-util.js';
import { youtubeApi } from '../../libs/google.js';
import YouTubeChannel from '../../models/youtube-channel.js';
import DiscordBotConfig from '../config.js';
import CustomBotCommand from './index.js';

const add_yt_channel = new CustomBotCommand({
  data: new SlashCommandBuilder()
    .setName('add-yt-channel')
    .setDescription("Add a YouTube channel to the bot's supported list.")
    .setDefaultMemberPermissions(DiscordBotConfig.moderatorPermissions)
    .addStringOption(genericOption('id', 'YouTube channel ID or video ID', true)),
  async execute(interaction) {
    const { user, options } = interaction;

    await interaction.deferReply({ ephemeral: true });

    const id = options.getString('id', true);

    let channelId: string;
    if (id.startsWith('UC') && id.length === 24) {
      channelId = id;
    } else {
      let videoChannelId: string | null | undefined = undefined;
      try {
        const response = await youtubeApi.videos.list({ part: ['snippet'], id: [id] });
        videoChannelId = response.data.items?.[0]?.snippet?.channelId;
      } catch (error) {
        console.error(error);
      }
      if (!videoChannelId) {
        await interaction.editReply({
          content:
            `Could not find a YouTube video for the video ID: \`${id}\`. Please try again. Here are some examples:\n\n` +
            `The channel ID of <https://www.youtube.com/channel/UCZlDXzGoo7d44bwdNObFacg> is \`UCZlDXzGoo7d44bwdNObFacg\`. It must begins with 'UC...'. Currently we don't support custom channel ID search (e.g. \`@AmaneKanata\`). If you cannot find a valid channel ID, please provide a video ID instead.\n\n` +
            `The video ID of <https://www.youtube.com/watch?v=Dji-ehIz5_k> is \`Dji-ehIz5_k\`.`,
        });
        return;
      } else {
        channelId = videoChannelId;
      }
    }

    let channel: youtube_v3.Schema$Channel | undefined = undefined;
    try {
      const response = await youtubeApi.channels.list({ part: ['snippet'], id: [channelId] });
      channel = response.data.items?.[0];
    } catch (error) {
      console.error(error);
    }

    if (
      !channel ||
      !channel.id ||
      !channel.snippet ||
      !channel.snippet.title ||
      !channel.snippet.description ||
      !channel.snippet.customUrl ||
      !channel.snippet.thumbnails?.high?.url
    ) {
      await interaction.editReply({
        content: `Could not find a YouTube channel for the channel ID: \`${channelId}\`. Please try again.`,
      });
      return;
    }

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm')
        .setLabel('Yes, I confirm')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('cancel').setLabel('No, cancel').setStyle(ButtonStyle.Danger),
    );

    const response = await interaction.editReply({
      content:
        "Are you sure you want to add the following YouTube channel to the bot's supported list?",
      components: [actionRow],
      embeds: [
        new EmbedBuilder()
          .setAuthor({
            name: `${user.username}#${user.discriminator}`,
            iconURL: user.displayAvatarURL(),
          })
          .setTitle(channel.snippet.title)
          .setDescription(channel.snippet.description)
          .setURL(`https://www.youtube.com/channel/${channel.id}`)
          .setThumbnail(channel.snippet.thumbnails.high.url)
          .addFields([
            {
              name: 'Channel ID',
              value: channel.id,
              inline: true,
            },
            {
              name: 'Custom URL',
              value: `[${channel.snippet.customUrl}](https://www.youtube.com/${channel.snippet.customUrl})`,
              inline: true,
            },
          ])
          .setTimestamp()
          .setColor('Random')
          .setFooter({ text: `ID: ${user.id}` }),
      ],
    });

    let buttonInteraction: ButtonInteraction<CacheType> | undefined = undefined;
    try {
      buttonInteraction = await response.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (buttonInteraction) => user.id === buttonInteraction.user.id,
        time: 60 * 1000,
      });
    } catch (error) {
      // Timeout
    }
    if (!buttonInteraction) {
      await interaction.editReply({
        content: 'Timed out. Please try again.',
        components: [],
      });
    } else if (buttonInteraction.customId === 'cancel') {
      await buttonInteraction.reply({
        content: 'Cancelled.',
        ephemeral: true,
      });
    } else if (buttonInteraction.customId === 'confirm') {
      await buttonInteraction.deferReply({ ephemeral: true });
      const youTubeChannel = await YouTubeChannel.findByIdAndUpdate(
        channel.id,
        {
          $set: {
            title: channel.snippet.title,
            description: channel.snippet.description,
            customUrl: channel.snippet.customUrl,
            thumbnail: channel.snippet.thumbnails.high.url,
          },
          $setOnInsert: {
            _id: channelId,
          },
        },
        { upsert: true, new: true },
      );
      await buttonInteraction.editReply({
        content: `Successfully added the YouTube channel \`${youTubeChannel.title}\` to the bot's supported list.`,
      });
    } else {
      await buttonInteraction.reply({
        content: 'An error occurred. Please try again.',
        ephemeral: true,
      });
      return;
    }
  },
});

export default add_yt_channel;
