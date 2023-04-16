import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CacheType,
  ChatInputCommandInteraction,
  ComponentType,
  InteractionReplyOptions,
} from 'discord.js';

import { CustomError } from './error.js';

const awaitConfirm = async (
  originalInteraction: ChatInputCommandInteraction<CacheType>,
  uniquePrefix: string,
  payload: InteractionReplyOptions,
  timeout = 60 * 1000,
) => {
  if (!originalInteraction.deferred) {
    await originalInteraction.deferReply({ ephemeral: true });
  }

  // Ask for confirmation
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${uniquePrefix}-confirm-button`)
      .setLabel('Confirm')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${uniquePrefix}-cancel-button`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );

  const response = await originalInteraction.editReply({
    ...payload,
    components: [actionRow],
  });

  // Wait for user's confirmation
  let buttonInteraction: ButtonInteraction<CacheType> | undefined = undefined;
  try {
    buttonInteraction = await response.awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (buttonInteraction) =>
        originalInteraction.user.id === buttonInteraction.user.id &&
        [`${uniquePrefix}-confirm-button`, `${uniquePrefix}-cancel-button`].includes(
          buttonInteraction.customId,
        ),
      time: timeout,
    });
  } catch (error) {
    // Timeout
  }
  if (!buttonInteraction) {
    // Timeout
    await originalInteraction.editReply({
      components: [],
    });
    throw new CustomError('Timed out. Please try again.', originalInteraction);
  } else if (buttonInteraction.customId === `${uniquePrefix}-cancel-button`) {
    // Cancelled
    actionRow.components.forEach((component) => component.setDisabled(true));
    await originalInteraction.editReply({
      components: [actionRow],
    });
    throw new CustomError('Cancelled', buttonInteraction);
  } else if (buttonInteraction.customId === `${uniquePrefix}-confirm-button`) {
    actionRow.components.forEach((component) => component.setDisabled(true));
    await originalInteraction.editReply({
      components: [actionRow],
    });
  }
  return buttonInteraction;
};

export default awaitConfirm;
