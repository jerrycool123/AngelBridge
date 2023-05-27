import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ComponentType,
  InteractionReplyOptions,
  RepliableInteraction,
} from 'discord.js';

import { BadRequestError, RequestTimeoutError } from '../../libs/error.js';
import { BotErrorConfig } from '../../types/bot.js';

const awaitConfirm = async (
  originalInteraction: RepliableInteraction,
  uniquePrefix: string,
  payload: InteractionReplyOptions,
  errorConfig: BotErrorConfig,
  timeout = 60 * 1000,
) => {
  errorConfig.activeInteraction = originalInteraction;
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
  let buttonInteraction: ButtonInteraction | undefined = undefined;
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
  if (buttonInteraction === undefined) {
    // Timeout
    await originalInteraction.editReply({
      components: [],
    });
    throw new RequestTimeoutError('Timed out. Please try again.');
  } else if (buttonInteraction.customId === `${uniquePrefix}-cancel-button`) {
    // Cancelled
    actionRow.components.forEach((component) => component.setDisabled(true));
    await originalInteraction.editReply({
      components: [actionRow],
    });
    errorConfig.activeInteraction = buttonInteraction;
    throw new BadRequestError('Cancelled');
  } else if (buttonInteraction.customId === `${uniquePrefix}-confirm-button`) {
    actionRow.components.forEach((component) => component.setDisabled(true));
    await originalInteraction.editReply({
      components: [actionRow],
    });
  }
  return buttonInteraction;
};

export default awaitConfirm;
