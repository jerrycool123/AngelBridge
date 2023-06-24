import { ClientEvents } from 'discord.js';

import { Bot, BotEventHandler } from '../../types/bot.js';
import { DBUtils } from '../../utils/db.js';

export class GuildUpdateEventHandler implements BotEventHandler<'guildUpdate'> {
  public readonly name = 'guildUpdate';

  public async execute(
    bot: Bot<true>,
    ...[, newGuild]: ClientEvents['guildUpdate']
  ): Promise<void> {
    await DBUtils.upsertGuild({
      id: newGuild.id,
      name: newGuild.name,
      icon: newGuild.iconURL(),
    });
  }
}
