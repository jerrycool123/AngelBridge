import { SelectMenuComponentOptionData } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';

import { BotConfig } from '../config.js';

export class BotActionRows {
  public static createAdminVerificationActionRow(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(BotConfig.AdminMembershipVerificationActionId.accept)
        .setStyle(ButtonStyle.Success)
        .setLabel('Accept'),
      new ButtonBuilder()
        .setCustomId(BotConfig.AdminMembershipVerificationActionId.reject)
        .setStyle(ButtonStyle.Danger)
        .setLabel('Reject'),
      new ButtonBuilder()
        .setCustomId(BotConfig.AdminMembershipVerificationActionId.modify)
        .setStyle(ButtonStyle.Primary)
        .setLabel('Modify'),
    );
  }

  public static createDisabledInvalidActionRow(
    label = 'Invalid request',
    customId = 'anonymous-disabled-invalid-button',
  ): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(customId)
        .setStyle(ButtonStyle.Secondary)
        .setLabel(label)
        .setDisabled(true),
    );
  }

  public static createDisabledAccepted(
    label = 'Accepted',
    customId = 'anonymous-disabled-accepted-button',
  ): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(customId)
        .setStyle(ButtonStyle.Success)
        .setLabel(label)
        .setDisabled(true),
    );
  }

  public static createDisabledRejectedActionRow(
    label = 'Rejected',
    customId = 'anonymous-disabled-rejected-button',
  ): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(customId)
        .setStyle(ButtonStyle.Danger)
        .setLabel(label)
        .setDisabled(true),
    );
  }

  public static createConfirmationActionRow(
    confirmCustomId: string,
    cancelCustomId: string,
  ): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(confirmCustomId)
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(cancelCustomId)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    );
  }

  public static createSuccessActionRow(
    customId: string,
    label: string,
  ): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(ButtonStyle.Success),
    );
  }

  public static createPaginationActionRow(
    prevCustomId: string,
    nextCustomId: string,
  ): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(prevCustomId).setLabel('<').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(nextCustomId).setLabel('>').setStyle(ButtonStyle.Primary),
    );
  }

  public static createSelectionActionRow(
    customId: string,
    placeHolder: string,
    options: SelectMenuComponentOptionData[],
  ): ActionRowBuilder<StringSelectMenuBuilder> {
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder(placeHolder)
        .addOptions(options),
    );
  }
}
