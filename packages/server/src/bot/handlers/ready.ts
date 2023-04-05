import DiscordBotConfig from '../config.js';
import CustomBotEventHandler from './index.js';

// When the client is ready, run this code (only once)
const ready = new CustomBotEventHandler<'ready'>({
  name: 'ready',
  once: true,
  execute: async (client) => {
    console.log(`${client.user.username} [ID: ${client.user.id}] is ready!`);
    await DiscordBotConfig.registerBotGlobalCommands();
    await DiscordBotConfig.registerBotGuildCommands('949939725001715762');
  },
});

export default ready;
