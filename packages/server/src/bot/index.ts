import { Client } from 'discord.js';

import membershipAcceptButton from './buttons/membership-accept.js';
import membershipModifyButton from './buttons/membership-modify.js';
import membershipRejectButton from './buttons/membership-reject.js';
import add_role from './commands/add-role.js';
import add_yt_channel from './commands/add-yt-channel.js';
import ocr from './commands/ocr.js';
import set_log_channel from './commands/set-log-channel.js';
import settings from './commands/settings.js';
import test from './commands/test.js';
import verify from './commands/verify.js';
import DiscordBotConfig from './config.js';
import guildCreate from './handlers/guild-create.js';
import guildUpdate from './handlers/guild-update.js';
import interactionCreate from './handlers/interaction-create.js';
import ready from './handlers/ready.js';

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
DiscordBotConfig.addButtons([
  membershipAcceptButton,
  membershipRejectButton,
  membershipModifyButton,
]);
DiscordBotConfig.addEventHandlers([ready, interactionCreate, guildCreate, guildUpdate]);

// Create a new client instance
const client = new Client<true>({ intents: DiscordBotConfig.requiredIntents });

// Register event handlers
DiscordBotConfig.registerBotEventHandlers(client);

// Print custom config
DiscordBotConfig.show();

export default client;
