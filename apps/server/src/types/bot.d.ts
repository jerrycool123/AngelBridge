import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  ClientEvents,
  Guild,
  GuildChannel,
  RepliableInteraction,
  SlashCommandBuilder,
} from 'discord.js';

/**
 * Button Trigger
 */

export interface BotButtonTrigger<GuildOnly extends boolean> {
  customId: string;
  guildOnly: GuildOnly;
  botHasManageRolePermission: BooleanOrFalse<GuildOnly>;
  userHasManageRolePermission: BooleanOrFalse<GuildOnly>;

  execute: (
    bot: Bot<true>,
    interaction: GuildOnly extends true ? GuildButtonInteraction : ButtonInteraction,
    errorConfig: BotErrorConfig,
  ) => Promise<void>;
}

export type UnionBotButtonTrigger = BotButtonTrigger<true> | BotButtonTrigger<false>;

/**
 * Command Trigger
 */

export interface BotCommandTrigger<GuildOnly extends boolean> {
  data: Partial<SlashCommandBuilder>;
  guildOnly: GuildOnly;
  botHasManageRolePermission: BooleanOrFalse<GuildOnly>;

  execute(
    bot: Bot<true>,
    interaction: GuildOnly extends true
      ? GuildChatInputCommandInteraction
      : ChatInputCommandInteraction,
    errorConfig: BotErrorConfig,
  ): Promise<void>;
}

export type UnionBotCommandTrigger = BotCommandTrigger<true> | BotCommandTrigger<false>;

/**
 * Event Handler
 */

export interface BotEventHandler<E extends keyof ClientEvents> {
  name: E;
  once?: boolean;

  execute(bot: Bot<E extends 'ready' ? boolean : true>, ...args: ClientEvents[E]): Promise<void>;
}

export type Union<T> = T[keyof T];
export type UnionBotEventHandler = Union<{
  [K in keyof ClientEvents]: BotEventHandler<K>;
}>;

/**
 * Routine
 */
export interface BotRoutine {
  name: string;
  schedule: string;

  execute(bot: Bot): Promise<void>;
}

/**
 * Bot
 */

export interface Bot<Ready extends boolean> {
  client: Client<Ready>;
  commandTriggers: UnionBotCommandTrigger[];
  buttonTriggers: UnionBotButtonTrigger[];
  eventHandlers: UnionBotEventHandler[];

  start(): Promise<void>;
  registerCommands(): Promise<void>;
}

/**
 * Miscellaneous
 */

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
