import {
  ButtonInteraction,
  ComponentType,
  InteractionReplyOptions,
  RepliableInteraction,
  User,
} from 'discord.js';

import { BotErrorConfig } from '../../types/bot.js';
import { EventLogConfig, UserMeta } from '../../types/common.js';
import { BadRequestError, InternalServerError, RequestTimeoutError } from '../../utils/error.js';
import { BotActionRows } from '../components/index.js';

export class BotCommonUtils {
  public static getUserMeta(user: User): UserMeta {
    return {
      id: user.id,
      username: `${user.username}#${user.discriminator}`,
      avatar: user.displayAvatarURL(),
    };
  }

  public static async sendEventLog({
    content,
    guildOwner,
    logChannel,
  }: {
    content: string;
  } & Pick<EventLogConfig, 'guildOwner' | 'logChannel'>) {
    let logged = false;

    // Try to send event log to the log channel
    if (logChannel != null) {
      try {
        await logChannel.send(content);
        logged = true;
      } catch (error) {
        // We cannot send log to the log channel
        console.error(error);
      }
    }

    // If the log is failed to send, try to DM the guild owner about the removal
    if (logged === false && guildOwner != null) {
      try {
        await guildOwner.send(
          `> I cannot send event log to the log channel in your server \`${guildOwner.guild.name}\`.\n` +
            `> Please make sure that the log channel is set with \`/set-log-channel\`, and that I have enough permissions to send messages in it.\n\n` +
            content,
        );
        logged = true;
      } catch (error) {
        // We cannot DM the owner
        console.error(error);
      }
    }

    return logged;
  }

  public static async awaitUserConfirm(
    originalInteraction: RepliableInteraction,
    uniquePrefix: string,
    payload: InteractionReplyOptions,
    errorConfig: BotErrorConfig,
    timeout = 60 * 1000,
  ): Promise<ButtonInteraction> {
    errorConfig.activeInteraction = originalInteraction;
    if (!originalInteraction.deferred) {
      await originalInteraction.deferReply({ ephemeral: true });
    }

    // Ask for confirmation
    const [confirmCustomId, cancelCustomId] = [
      `${uniquePrefix}-confirm-button`,
      `${uniquePrefix}-cancel-button`,
    ];
    const confirmActionRow = BotActionRows.createConfirmationActionRow(
      confirmCustomId,
      cancelCustomId,
    );
    const response = await originalInteraction.genericReply({
      ...payload,
      components: [confirmActionRow],
    });

    // Wait for user's confirmation
    let buttonInteraction: ButtonInteraction;
    try {
      buttonInteraction = await response.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (buttonInteraction) =>
          originalInteraction.user.id === buttonInteraction.user.id &&
          [confirmCustomId, cancelCustomId].includes(buttonInteraction.customId),
        time: timeout,
      });
    } catch (error) {
      // Timeout
      await originalInteraction.genericReply({
        components: [],
      });
      throw new RequestTimeoutError('Timed out. Please try again.');
    }

    // When user clicked cancel button
    if (buttonInteraction.customId === cancelCustomId) {
      confirmActionRow.components.forEach((component) => component.setDisabled(true));
      await originalInteraction.genericReply({
        components: [confirmActionRow],
      });

      errorConfig.activeInteraction = buttonInteraction;
      throw new BadRequestError('Cancelled');
    }

    // When user clicked confirm button
    if (buttonInteraction.customId === confirmCustomId) {
      confirmActionRow.components.forEach((component) => component.setDisabled(true));
      await originalInteraction.genericReply({
        components: [confirmActionRow],
      });
      return buttonInteraction;
    }

    // This should not happen
    errorConfig.activeInteraction = buttonInteraction;
    throw new InternalServerError('Unknown error');
  }
}
