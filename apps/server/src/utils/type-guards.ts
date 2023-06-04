import { GuildChannel, RepliableInteraction } from 'discord.js';

import { BotButtonTrigger, BotCommandTrigger, GuildRepliableInteraction } from '../types/bot.js';

export class TypeGuards {
  // Bot related type guards

  public static isGuildOnlyBotCommand(
    command: BotCommandTrigger<boolean>,
  ): command is BotCommandTrigger<true> {
    return command.guildOnly === true;
  }

  public static isGuildOnlyBotButton(
    button: BotButtonTrigger<boolean>,
  ): button is BotButtonTrigger<true> {
    return button.guildOnly === true;
  }

  public static isGuildRepliableInteraction<T extends RepliableInteraction>(
    interaction: T,
  ): interaction is GuildRepliableInteraction<T> {
    const { guild, channel } = interaction;
    return guild !== null && channel !== null && channel instanceof GuildChannel;
  }
}
