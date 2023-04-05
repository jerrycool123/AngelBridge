import { upsertGuildConfig } from '../../libs/discord-util.js';
import CustomBotEventHandler from './index.js';

const guildUpdate = new CustomBotEventHandler<'guildUpdate'>({
  name: 'guildUpdate',
  execute: async (_oldGuild, newGuild) => {
    await upsertGuildConfig(newGuild);
  },
});

export default guildUpdate;
