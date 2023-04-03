import { Client } from 'discord.js';

import add_role from './commands/add-role';
import add_yt_channel from './commands/add-yt-channel';
import ocr from './commands/ocr';
import set_log_channel from './commands/set-log-channel';
import settings from './commands/settings';
import test from './commands/test';
import verify from './commands/verify';
import DiscordBotConfig from './config';
import guildCreate from './handlers/guild-create';
import guildUpdate from './handlers/guild-update';
import interactionCreate from './handlers/interaction-create';
import ready from './handlers/ready';

// Bot config
DiscordBotConfig.addGlobalCommands([ocr]);
DiscordBotConfig.addGuildCommands([
  test,
  settings,
  add_yt_channel,
  add_role,
  verify,
  set_log_channel,
]);
DiscordBotConfig.addEventHandlers([ready, interactionCreate, guildCreate, guildUpdate]);

// Create a new client instance
const client = new Client({ intents: DiscordBotConfig.requiredIntents });

// Register event handlers
DiscordBotConfig.registerBotEventHandlers(client);

// Print custom config
DiscordBotConfig.show();

export default client;
