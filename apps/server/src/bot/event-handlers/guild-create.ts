import { ClientEvents } from 'discord.js';

import { Bot, BotEventHandler } from '../../types/bot.js';
import { upsertGuildCollection } from '../utils/db.js';

export class GuildCreateEventHandler implements BotEventHandler<'guildCreate'> {
  public readonly name = 'guildCreate';

  public async execute(bot: Bot, ...[guild]: ClientEvents['guildCreate']): Promise<void> {
    console.log(`Joined guild ${guild.name} [ID: ${guild.id}]`);
    await upsertGuildCollection(guild);
  }
}
