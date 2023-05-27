import { ClientEvents } from 'discord.js';

import { Bot, BotEventHandler } from '../../types/bot.js';
import { updateMembershipRoleCollection } from '../utils/db.js';

export class RoleUpdateEventHandler implements BotEventHandler<'roleUpdate'> {
  public readonly name = 'roleUpdate';

  public async execute(bot: Bot, ...[, newRole]: ClientEvents['roleUpdate']): Promise<void> {
    await updateMembershipRoleCollection(newRole);
  }
}
