import {
  ApplicationCommandOptionBase,
  CommandInteraction,
  InteractionResponse,
  Message,
  MessageComponentInteraction,
  ModalSubmitInteraction,
  RepliableInteraction,
  SlashCommandBuilder,
} from 'discord.js';

import { GenericOption, GenericReplyOptions } from '../types/discord.js';

CommandInteraction.prototype.genericReply = genericReply;
MessageComponentInteraction.prototype.genericReply = genericReply;
ModalSubmitInteraction.prototype.genericReply = genericReply;

function genericReply<T extends RepliableInteraction>(
  this: T,
  { ephemeral, followUp, ...options }: GenericReplyOptions,
): Promise<Message> | Promise<InteractionResponse> {
  if (followUp === true && (this.replied === true || this.deferred === true)) {
    return this.followUp({ ...options, ephemeral });
  } else if (this.deferred === true) {
    return this.editReply(options);
  } else {
    return this.reply({ ...options, ephemeral });
  }
}

SlashCommandBuilder.prototype.addGenericBooleanOption = function (
  ...args
): ReturnType<SlashCommandBuilder['addBooleanOption']> {
  return this.addBooleanOption(genericOption(...args));
};
SlashCommandBuilder.prototype.addGenericUserOption = function (
  ...args
): ReturnType<SlashCommandBuilder['addUserOption']> {
  return this.addUserOption(genericOption(...args));
};
SlashCommandBuilder.prototype.addGenericChannelOption = function (
  ...args
): ReturnType<SlashCommandBuilder['addChannelOption']> {
  return this.addChannelOption(genericOption(...args));
};
SlashCommandBuilder.prototype.addGenericRoleOption = function (
  ...args
): ReturnType<SlashCommandBuilder['addRoleOption']> {
  return this.addRoleOption(genericOption(...args));
};
SlashCommandBuilder.prototype.addGenericAttachmentOption = function (
  ...args
): ReturnType<SlashCommandBuilder['addAttachmentOption']> {
  return this.addAttachmentOption(genericOption(...args));
};
SlashCommandBuilder.prototype.addGenericMentionableOption = function (
  ...args
): ReturnType<SlashCommandBuilder['addMentionableOption']> {
  return this.addMentionableOption(genericOption(...args));
};
SlashCommandBuilder.prototype.addGenericStringOption = function (
  ...args
): ReturnType<SlashCommandBuilder['addStringOption']> {
  return this.addStringOption(genericOption(...args));
};
SlashCommandBuilder.prototype.addGenericIntegerOption = function (
  ...args
): ReturnType<SlashCommandBuilder['addIntegerOption']> {
  return this.addIntegerOption(genericOption(...args));
};
SlashCommandBuilder.prototype.addGenericNumberOption = function (
  ...args
): ReturnType<SlashCommandBuilder['addNumberOption']> {
  return this.addNumberOption(genericOption(...args));
};

const genericOption =
  <T extends ApplicationCommandOptionBase>(
    ...[name, description, required = false]: GenericOption
  ) =>
  (option: T) =>
    option.setName(name).setDescription(description).setRequired(required);
