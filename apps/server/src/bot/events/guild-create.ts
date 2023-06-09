import { ClientEvents } from 'discord.js';

import { Bot, BotEventHandler } from '../../types/bot.js';
import { DBUtils } from '../../utils/db.js';

export class GuildCreateEventHandler implements BotEventHandler<'guildCreate'> {
  public readonly name = 'guildCreate';

  public async execute(bot: Bot<true>, ...[guild]: ClientEvents['guildCreate']): Promise<void> {
    console.log(`Joined guild ${guild.name} [ID: ${guild.id}]`);
    await DBUtils.upsertGuild({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL(),
    });
  }
}
