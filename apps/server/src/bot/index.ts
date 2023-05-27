import { Client } from 'discord.js';

import { Env } from '../libs/env.js';
import { UnionBotButton, UnionBotCommand, UnionBotEventHandler } from '../types/bot.js';
import { DiscordBot } from './bot.js';
import {
  MembershipAcceptButton,
  MembershipModifyButton,
  MembershipRejectButton,
} from './buttons/index.js';
import {
  AddMemberCommand,
  AddRoleCommand,
  AddYouTubeChannelCommand,
  CheckMemberCommand,
  DeleteMemberCommand,
  DeleteRoleCommand,
  ListMembersCommand,
  SetLogChannelCommand,
  SettingsCommand,
  TestCommand,
  VerifyCommand,
} from './commands/index.js';
import { BotConstants } from './constants.js';
import {
  GuildCreateEventHandler,
  GuildUpdateEventHandler,
  InteractionCreateEventHandler,
  ReadyEventHandler,
  RoleUpdateEventHandler,
} from './event-handlers/index.js';

// Client
const client = new Client<false>({ intents: BotConstants.Intents });

// Buttons
const buttons: UnionBotButton[] = [
  new MembershipAcceptButton(),
  new MembershipModifyButton(),
  new MembershipRejectButton(),
];

// Commands
const commands: UnionBotCommand[] = [
  new AddMemberCommand(),
  new AddRoleCommand(),
  new AddYouTubeChannelCommand(),
  new CheckMemberCommand(),
  new DeleteMemberCommand(),
  new DeleteRoleCommand(),
  new ListMembersCommand(),
  new SetLogChannelCommand(),
  new SettingsCommand(),
  new TestCommand(),
  new VerifyCommand(),
];

// Event handlers
const eventHandlers: UnionBotEventHandler[] = [
  new GuildCreateEventHandler(),
  new GuildUpdateEventHandler(),
  new InteractionCreateEventHandler(),
  new ReadyEventHandler(),
  new RoleUpdateEventHandler(),
];

// Bot
export const bot = new DiscordBot(Env.DISCORD_BOT_TOKEN, client, commands, buttons, eventHandlers);
