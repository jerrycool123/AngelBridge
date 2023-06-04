import { Client } from 'discord.js';

import {
  BotRoutine,
  UnionBotButtonTrigger,
  UnionBotCommandTrigger,
  UnionBotEventHandler,
} from '../types/bot.js';
import { Env } from '../utils/env.js';
import { DiscordBot } from './bot.js';
import { BotConfig } from './config.js';
import {
  GuildCreateEventHandler,
  GuildUpdateEventHandler,
  InteractionCreateEventHandler,
  ReadyEventHandler,
  RoleUpdateEventHandler,
} from './events/index.js';
import { CheckOAuthMembershipRoutine } from './routines/check-oauth-membership.js';
import { CheckOCRMembershipRoutine } from './routines/check-ocr-membership.js';
import {
  AddMemberCommandTrigger,
  AddRoleCommandTrigger,
  AddYouTubeChannelCommandTrigger,
  CheckMemberCommandTrigger,
  DeleteMemberCommandTrigger,
  DeleteRoleCommandTrigger,
  ListMembersCommandTrigger,
  MembershipAcceptButtonTrigger,
  MembershipModifyButtonTrigger,
  MembershipRejectButtonTrigger,
  SetLogChannelCommandTrigger,
  SettingsCommandTrigger,
  TestCommandTrigger,
  VerifyCommandTrigger,
} from './triggers/index.js';

// Client
const client = new Client<false>({ intents: BotConfig.Intents });

// Button Triggers
const buttonTriggers: UnionBotButtonTrigger[] = [
  new MembershipAcceptButtonTrigger(),
  new MembershipModifyButtonTrigger(),
  new MembershipRejectButtonTrigger(),
];

// Command Triggers
const commandTriggers: UnionBotCommandTrigger[] = [
  new AddMemberCommandTrigger(),
  new AddRoleCommandTrigger(),
  new AddYouTubeChannelCommandTrigger(),
  new CheckMemberCommandTrigger(),
  new DeleteMemberCommandTrigger(),
  new DeleteRoleCommandTrigger(),
  new ListMembersCommandTrigger(),
  new SetLogChannelCommandTrigger(),
  new SettingsCommandTrigger(),
  new TestCommandTrigger(),
  new VerifyCommandTrigger(),
];

// Event Handlers
const eventHandlers: UnionBotEventHandler[] = [
  new GuildCreateEventHandler(),
  new GuildUpdateEventHandler(),
  new InteractionCreateEventHandler(),
  new ReadyEventHandler(),
  new RoleUpdateEventHandler(),
];

// Routines
const routines: BotRoutine[] = [new CheckOAuthMembershipRoutine(), new CheckOCRMembershipRoutine()];

// Bot
export const bot = new DiscordBot(
  Env.DISCORD_BOT_TOKEN,
  client,
  commandTriggers,
  buttonTriggers,
  eventHandlers,
  routines,
);
