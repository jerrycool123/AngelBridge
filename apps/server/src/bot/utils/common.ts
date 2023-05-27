import {
  ActionRowBuilder,
  ApplicationCommandOptionBase,
  ButtonBuilder,
  ButtonStyle,
  InteractionEditReplyOptions,
  InteractionReplyOptions,
  RepliableInteraction,
} from 'discord.js';

import { Intersect } from '../../types/common.js';

export const genericOption =
  <T extends ApplicationCommandOptionBase>(name: string, description: string, required = false) =>
  (option: T) =>
    option.setName(name).setDescription(description).setRequired(required);

export const genericReply =
  <T extends RepliableInteraction>(interaction: T, ephemeral = true) =>
  (
    options: Partial<Intersect<InteractionReplyOptions, InteractionEditReplyOptions>>,
    followUp = false,
  ) =>
    followUp && (interaction.replied || interaction.deferred)
      ? interaction.followUp({ ...options, ephemeral })
      : interaction.deferred
      ? interaction.editReply(options)
      : interaction.reply({ ...options, ephemeral });

export const createDisabledInvalidActionRow = (label = 'Invalid request') =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('global-disabled-invalid-button')
      .setStyle(ButtonStyle.Secondary)
      .setLabel(label)
      .setDisabled(true),
  );

export const createDisabledAcceptedActionRow = (label = 'Accepted') =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('global-disabled-accepted-button')
      .setStyle(ButtonStyle.Success)
      .setLabel(label)
      .setDisabled(true),
  );

export const createDisabledRejectedActionRow = (label = 'Rejected') =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('global-disabled-rejected-button')
      .setStyle(ButtonStyle.Danger)
      .setLabel(label)
      .setDisabled(true),
  );
