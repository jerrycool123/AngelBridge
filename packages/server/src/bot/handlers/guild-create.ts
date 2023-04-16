import DiscordBotConfig from '../config.js';
import { upsertGuildCollection } from '../utils/db.js';
import CustomBotEventHandler from './index.js';

const guildCreate = new CustomBotEventHandler<'guildCreate'>({
  name: 'guildCreate',
  execute: async (guild) => {
    console.log(`Joined guild ${guild.name} [ID: ${guild.id}]`);
    await Promise.all([
      DiscordBotConfig.registerBotGuildCommands(guild.id),
      upsertGuildCollection(guild),
    ]);
  },
});

export default guildCreate;
