import { SlashCommandBuilder } from 'discord.js';

import { Bot, BotCommandTrigger, GuildChatInputCommandInteraction } from '../../../types/bot.js';

export class TestCommandTrigger implements BotCommandTrigger<true> {
  public readonly data = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!');
  public readonly guildOnly = true;
  public readonly botHasManageRolePermission = false;

  public async execute(bot: Bot, interaction: GuildChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    await interaction.genericReply({
      content: 'Pong!',
    });
  }
}
