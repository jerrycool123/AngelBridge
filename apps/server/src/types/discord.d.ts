/* eslint-disable @typescript-eslint/no-empty-interface */
import type {
  InteractionEditReplyOptions,
  InteractionReplyOptions,
  InteractionResponse,
  Message,
} from 'discord.js';

export type Intersect<T, U> = {
  [K in Extract<keyof T, keyof U>]: T[K] & U[K];
};

export type GenericReplyOptions = Partial<
  Intersect<InteractionReplyOptions, InteractionEditReplyOptions> & {
    ephemeral: boolean;
    followUp: boolean;
  }
>;

export interface WithGenericReply {
  genericReply(options: GenericReplyOptions): Promise<Message | InteractionResponse>;
}

export type GenericOption = [string, string, boolean?];

declare module 'discord.js' {
  interface CommandInteraction extends WithGenericReply {}
  interface MessageComponentInteraction extends WithGenericReply {}
  interface ButtonInteraction extends WithGenericReply {}
  interface ModalSubmitInteraction extends WithGenericReply {}

  interface SlashCommandBuilder {
    addGenericBooleanOption(
      ...args: GenericOption
    ): ReturnType<SlashCommandBuilder['addBooleanOption']>;
    addGenericUserOption(...args: GenericOption): ReturnType<SlashCommandBuilder['addUserOption']>;
    addGenericChannelOption(
      ...args: GenericOption
    ): ReturnType<SlashCommandBuilder['addChannelOption']>;
    addGenericRoleOption(...args: GenericOption): ReturnType<SlashCommandBuilder['addRoleOption']>;
    addGenericAttachmentOption(
      ...args: GenericOption
    ): ReturnType<SlashCommandBuilder['addAttachmentOption']>;
    addGenericMentionableOption(
      ...args: GenericOption
    ): ReturnType<SlashCommandBuilder['addMentionableOption']>;
    addGenericStringOption(
      ...args: GenericOption
    ): ReturnType<SlashCommandBuilder['addStringOption']>;
    addGenericIntegerOption(
      ...args: GenericOption
    ): ReturnType<SlashCommandBuilder['addIntegerOption']>;
    addGenericNumberOption(
      ...args: GenericOption
    ): ReturnType<SlashCommandBuilder['addNumberOption']>;
  }
}
