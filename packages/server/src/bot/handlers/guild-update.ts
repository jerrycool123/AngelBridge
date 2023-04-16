import { upsertGuildCollection } from '../utils/db.js';
import CustomBotEventHandler from './index.js';

const guildUpdate = new CustomBotEventHandler<'guildUpdate'>({
  name: 'guildUpdate',
  execute: async (_oldGuild, newGuild) => {
    await upsertGuildCollection(newGuild);
  },
});

export default guildUpdate;
