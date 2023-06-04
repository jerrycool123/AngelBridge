import {
  ActionRowBuilder,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

export class BotModals {
  public static createDateModificationModal(
    modalCustomId: string,
    inputCustomId: string,
  ): ModalBuilder {
    return new ModalBuilder()
      .setCustomId(modalCustomId)
      .setTitle('Modify Date')
      .addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId(inputCustomId)
            .setLabel('Correct Date (must be YYYY/MM/DD)')
            .setPlaceholder('YYYY/MM/DD')
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        ),
      );
  }

  public static createRejectionModal(modalCustomId: string, inputCustomId: string): ModalBuilder {
    return new ModalBuilder()
      .setCustomId(modalCustomId)
      .setTitle('Reject Request')
      .addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId(inputCustomId)
            .setLabel('Reason (this will be sent to the user)')
            .setPlaceholder('Reason...')
            .setStyle(TextInputStyle.Short)
            .setRequired(false),
        ),
      );
  }
}
