import { SlashCommandBuilder } from 'discord.js';

import { BotCommand, GuildChatInputCommandInteraction } from '../../types/bot.js';

export class TestCommand implements BotCommand<true> {
  public readonly data = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!');
  public readonly guildOnly = true;
  public readonly botHasManageRolePermission = false;

  public async execute(interaction: GuildChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    await interaction.genericReply({
      content: 'Pong!',
    });
  }
}
