import { ClientEvents } from 'discord.js';

import { Bot, BotEventHandler } from '../../types/bot.js';

export class ReadyEventHandler implements BotEventHandler<'ready'> {
  public readonly name = 'ready';
  public readonly once = true;

  public async execute(bot: Bot, ...[client]: ClientEvents['ready']): Promise<void> {
    console.log(`${client.user.username} [ID: ${client.user.id}] is ready!`);
    await bot.registerCommands();
  }
}
