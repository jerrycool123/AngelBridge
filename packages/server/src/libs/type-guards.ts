import { GuildChannel, RepliableInteraction } from 'discord.js';

import { BotButton, BotCommand, GuildRepliableInteraction } from '../types/bot.js';

export class TypeGuards {
  // Bot related type guards

  public static isGuildOnlyBotCommand(command: BotCommand<boolean>): command is BotCommand<true> {
    return command.guildOnly === true;
  }

  public static isGuildOnlyBotButton(button: BotButton<boolean>): button is BotButton<true> {
    return button.guildOnly === true;
  }

  public static isGuildRepliableInteraction<T extends RepliableInteraction>(
    interaction: T,
  ): interaction is GuildRepliableInteraction<T> {
    const { guild, channel } = interaction;
    return guild !== null && channel !== null && channel instanceof GuildChannel;
  }
}
