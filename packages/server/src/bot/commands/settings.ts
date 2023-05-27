import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import MembershipRoleCollection from '../../models/membership-role.js';
import { YouTubeChannelDoc } from '../../models/youtube-channel.js';
import { BotCommand, GuildChatInputCommandInteraction } from '../../types/bot.js';
import { BotConstants } from '../constants.js';
import { upsertGuildCollection } from '../utils/db.js';

export class SettingsCommand implements BotCommand<true> {
  public readonly data = new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Display guild settings')
    .setDefaultMemberPermissions(BotConstants.ModeratorPermissions);
  public readonly guildOnly = true;
  public readonly botHasManageRolePermission = false;

  public async execute(interaction: GuildChatInputCommandInteraction): Promise<void> {
    const { guild, user } = interaction;

    await interaction.deferReply({ ephemeral: true });

    // Get guild config and membership roles
    const [guildConfig, membershipRoleDocs] = await Promise.all([
      upsertGuildCollection(guild),
      MembershipRoleCollection.find({ guild: guild.id }).populate<{
        youTubeChannel: YouTubeChannelDoc | null;
      }>('youTubeChannel'),
    ]);

    // Send settings
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
              value: guildConfig.logChannel !== null ? `<#${guildConfig.logChannel}>` : 'None',
            },
            {
              name: 'Membership Roles',
              value:
                membershipRoleDocs.length > 0
                  ? membershipRoleDocs
                      .map(
                        ({ _id, youTubeChannel }) =>
                          `<@&${_id}> - ${
                            youTubeChannel !== null
                              ? `[${youTubeChannel.title}](https://www.youtube.com/channel/${youTubeChannel._id}) ([${youTubeChannel.customUrl}](https://www.youtube.com/${youTubeChannel.customUrl}))`
                              : '[Unknown Channel]'
                          }`,
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
  }
}
