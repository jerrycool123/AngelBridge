import { upsertGuildConfig } from '../../libs/discord-util.js';
import DiscordBotConfig from '../config.js';
import CustomBotEventHandler from './index.js';

const guildCreate = new CustomBotEventHandler<'guildCreate'>({
  name: 'guildCreate',
  execute: async (guild) => {
    console.log(`Joined guild ${guild.name} [ID: ${guild.id}]`);
    await Promise.all([
      DiscordBotConfig.registerBotGuildCommands(guild.id),
      upsertGuildConfig(guild),
    ]);
  },
});

export default guildCreate;
