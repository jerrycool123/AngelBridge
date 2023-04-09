import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import { replyGuildOnly, upsertGuildConfig } from '../../libs/discord-util.js';
import MembershipRole from '../../models/membership-role.js';
import { YouTubeChannelDoc } from '../../models/youtube-channel.js';
import DiscordBotConfig from '../config.js';
import CustomBotCommand from './index.js';

const settings = new CustomBotCommand({
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Display guild settings')
    .setDefaultMemberPermissions(DiscordBotConfig.moderatorPermissions),
  async execute(interaction) {
    const { guild, user } = interaction;
    if (!guild) {
      await replyGuildOnly(interaction);
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    const guildConfig = await upsertGuildConfig(guild);

    const roles = await MembershipRole.find({ guild: guild.id }).populate<{
      youTubeChannel: YouTubeChannelDoc;
    }>('youTubeChannel');

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setAuthor({
            name: `${user.username}#${user.discriminator}`,
            iconURL: user.displayAvatarURL(),
          })
          .setTitle('Guild Settings')
          .setThumbnail(guild.iconURL())
          .addFields([
            {
              name: 'Guild name',
              value: guildConfig.name,
              inline: true,
            },
            {
              name: 'Guild ID',
              value: guildConfig._id,
              inline: true,
            },
            {
              name: 'Log channel',
              value: guildConfig.logChannel ? `<#${guildConfig.logChannel}>` : 'None',
            },
            {
              name: 'Allow OAuth 2.0 Verification',
              value: guildConfig.allowedMembershipVerificationMethods.oauth ? 'Yes' : 'No',
            },
            {
              name: 'Allow OCR Verification',
              value: guildConfig.allowedMembershipVerificationMethods.ocr ? 'Yes' : 'No',
            },
            {
              name: 'Membership Roles',
              value:
                roles.length > 0
                  ? roles
                      .map(
                        ({ _id, youTubeChannel }) =>
                          `<@&${_id}> - [${youTubeChannel.title}](https://www.youtube.com/channel/${youTubeChannel._id}) ([${youTubeChannel.customUrl}](https://www.youtube.com/${youTubeChannel.customUrl}))`,
                      )
                      .join('\n')
                  : 'None',
            },
          ])
          .setTimestamp()
          .setColor('Random')
          .setFooter({ text: `ID: ${user.id}` }),
      ],
    });
  },
});

export default settings;
