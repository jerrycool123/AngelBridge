import { Client } from 'discord.js';

import membershipAcceptButton from './buttons/membership-accept.js';
import membershipModifyButton from './buttons/membership-modify.js';
import membershipRejectButton from './buttons/membership-reject.js';
import add_member from './commands/add-member.js';
import add_role from './commands/add-role.js';
import add_yt_channel from './commands/add-yt-channel.js';
import check_member from './commands/check-member.js';
import del_member from './commands/del-member.js';
import delete_role from './commands/delete-role.js';
import list_members from './commands/list-members.js';
import set_log_channel from './commands/set-log-channel.js';
import settings from './commands/settings.js';
import test from './commands/test.js';
import verify from './commands/verify.js';
import DiscordBotConfig from './config.js';
import guildCreate from './handlers/guild-create.js';
import guildUpdate from './handlers/guild-update.js';
import interactionCreate from './handlers/interaction-create.js';
import ready from './handlers/ready.js';
import roleUpdate from './handlers/role-update.js';

// Bot config
DiscordBotConfig.addGlobalCommands([verify]);
DiscordBotConfig.addGuildCommands([
  test,
  settings,
  add_yt_channel,
  add_role,
  delete_role,
  set_log_channel,
  list_members,
  check_member,
  add_member,
  del_member,
]);
DiscordBotConfig.addButtons([
  membershipAcceptButton,
  membershipRejectButton,
  membershipModifyButton,
]);
DiscordBotConfig.addEventHandlers([ready, interactionCreate, guildCreate, guildUpdate, roleUpdate]);

// Create a new client instance
const client = new Client<true>({ intents: DiscordBotConfig.requiredIntents });

// Register event handlers
DiscordBotConfig.registerBotEventHandlers(client);

// Print custom config
DiscordBotConfig.show();

export default client;
