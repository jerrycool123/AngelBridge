import { SlashCommandBuilder } from 'discord.js';

import MembershipRoleCollection from '../../../models/membership-role.js';
import { YouTubeChannelDoc } from '../../../models/youtube-channel.js';
import { Bot, BotCommandTrigger, GuildChatInputCommandInteraction } from '../../../types/bot.js';
import { DBUtils } from '../../../utils/db.js';
import { BotEmbeds } from '../../components/embeds.js';
import { BotConfig } from '../../config.js';

export class SettingsCommandTrigger implements BotCommandTrigger<true> {
  public readonly data = new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Display guild settings')
    .setDefaultMemberPermissions(BotConfig.ModeratorPermissions);
  public readonly guildOnly = true;
  public readonly botHasManageRolePermission = false;

  public async execute(bot: Bot, interaction: GuildChatInputCommandInteraction): Promise<void> {
    const { guild, user } = interaction;

    await interaction.deferReply({ ephemeral: true });

    // Get guild config and membership roles
    const [guildConfig, membershipRoleDocs] = await Promise.all([
      DBUtils.upsertGuild({
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL(),
      }),
      MembershipRoleCollection.find({ guild: guild.id }).populate<{
        youTubeChannel: YouTubeChannelDoc | null;
      }>('youTubeChannel'),
    ]);

    // Send settings
    const guildSettingsEmbed = BotEmbeds.createGuildSettingsEmbed(
      user,
      guildConfig,
      membershipRoleDocs,
    );
    await interaction.genericReply({
      embeds: [guildSettingsEmbed],
    });
  }
}
