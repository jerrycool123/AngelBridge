import {
  ButtonBuilder,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  ClientEvents,
  Guild,
  GuildChannel,
  RepliableInteraction,
  SlashCommandBuilder,
} from 'discord.js';

import { BooleanOrFalse } from './common.js';

// Button

export interface BotButton<GuildOnly extends boolean> {
  customId: string;
  data: ButtonBuilder;
  guildOnly: GuildOnly;
  botHasManageRolePermission: BooleanOrFalse<GuildOnly>;
  userHasManageRolePermission: BooleanOrFalse<GuildOnly>;

  execute: (
    interaction: GuildOnly extends true ? GuildButtonInteraction : ButtonInteraction,
    errorConfig: BotErrorConfig,
  ) => Promise<void>;
}

export type UnionBotButton = BotButton<true> | BotButton<false>;

// Command

export interface BotCommand<GuildOnly extends boolean> {
  data: Partial<SlashCommandBuilder>;
  guildOnly: GuildOnly;
  botHasManageRolePermission: BooleanOrFalse<GuildOnly>;

  execute(
    interaction: GuildOnly extends true
      ? GuildChatInputCommandInteraction
      : ChatInputCommandInteraction,
    errorConfig: BotErrorConfig,
  ): Promise<void>;
}

export type UnionBotCommand = BotCommand<true> | BotCommand<false>;

// Event Handler

export interface BotEventHandler<E extends keyof ClientEvents> {
  name: E;
  once?: boolean;

  execute(bot: Bot, ...args: ClientEvents[E]): Promise<void>;
}

type Union<T> = T[keyof T];
export type UnionBotEventHandler = Union<{
  [K in keyof ClientEvents]: BotEventHandler<K>;
}>;

// Bot

export interface Bot {
  client: UnionClient;
  commands: UnionBotCommand[];
  buttons: UnionBotButton[];
  eventHandlers: UnionBotEventHandler[];

  start(): Promise<void>;
  registerCommands(): Promise<void>;
}

export type UnionClient = Client<true> | Client<false>;

// Misc

export type GuildRepliableInteraction<T extends RepliableInteraction> = T & {
  guild: Guild;
  channel: GuildChannel;
};

export type GuildChatInputCommandInteraction =
  GuildRepliableInteraction<ChatInputCommandInteraction>;

export type GuildButtonInteraction = GuildRepliableInteraction<ButtonInteraction>;

export interface BotErrorConfig {
  activeInteraction: RepliableInteraction;
  followUp: boolean;
}
