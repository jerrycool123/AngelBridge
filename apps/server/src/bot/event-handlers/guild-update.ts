import { ClientEvents } from 'discord.js';

import { Bot, BotEventHandler } from '../../types/bot.js';
import { upsertGuildCollection } from '../utils/db.js';

export class GuildUpdateEventHandler implements BotEventHandler<'guildUpdate'> {
  public readonly name = 'guildUpdate';

  public async execute(bot: Bot, ...[, newGuild]: ClientEvents['guildUpdate']): Promise<void> {
    await upsertGuildCollection(newGuild);
  }
}
