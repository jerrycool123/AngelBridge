/* eslint-disable @typescript-eslint/no-empty-interface */
import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  InteractionEditReplyOptions,
  InteractionReplyOptions,
  InteractionResponse,
  Message,
  RepliableInteraction,
} from 'discord.js';

import { Intersect } from '../common.js';

export type GenericReplyOptions = Partial<
  Intersect<InteractionReplyOptions, InteractionEditReplyOptions> & {
    ephemeral: boolean;
    followUp: boolean;
  }
>;

export interface WithGenericReply {
  genericReply(options: GenericReplyOptions): Promise<Message | InteractionResponse>;
}

declare module 'discord.js' {
  interface ChatInputCommandInteraction extends WithGenericReply {}
  interface ButtonInteraction extends WithGenericReply {}
}

function genericReply<T extends RepliableInteraction>(
  this: T,
  { ephemeral, followUp, ...options }: GenericReplyOptions,
) {
  if (followUp === true && (this.replied === true || this.deferred === true)) {
    return this.followUp({ ...options, ephemeral });
  } else if (this.deferred === true) {
    return this.editReply(options);
  } else {
    return this.reply({ ...options, ephemeral });
  }
}

ChatInputCommandInteraction.prototype.genericReply = genericReply;
ButtonInteraction.prototype.genericReply = genericReply;
