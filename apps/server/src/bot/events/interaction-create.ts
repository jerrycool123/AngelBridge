import { ClientEvents } from 'discord.js';

import { Bot, BotErrorConfig, BotEventHandler } from '../../types/bot.js';
import { CustomError, ForbiddenError, MethodNotAllowedError } from '../../utils/error.js';
import { TypeGuards } from '../../utils/type-guards.js';
import { BotCheckers } from '../utils/index.js';

export class InteractionCreateEventHandler implements BotEventHandler<'interactionCreate'> {
  public readonly name = 'interactionCreate';

  public async execute(
    bot: Bot,
    ...[interaction]: ClientEvents['interactionCreate']
  ): Promise<void> {
    if (!interaction.isRepliable()) return;

    const errorConfig: BotErrorConfig = {
      activeInteraction: interaction,
      followUp: false,
    };
    try {
      if (interaction.isChatInputCommand()) {
        // Slash command
        const command = bot.commandTriggers.find(
          ({ data }) => data.name === interaction.commandName,
        );

        if (command === undefined) return;

        if (TypeGuards.isGuildOnlyBotCommand(command)) {
          if (!TypeGuards.isGuildRepliableInteraction(interaction)) {
            throw new MethodNotAllowedError('This command is only available in servers.');
          }

          const { channel, client } = interaction;
          if (
            command.botHasManageRolePermission === true &&
            BotCheckers.isUserHasManageRolePermissionInChannel(client.user, channel) === false
          ) {
            throw new ForbiddenError(
              'The bot does not have the `Manage Roles` permission in this server.\n' +
                'Please try again after giving the bot this permission.',
            );
          }

          await command.execute(bot, interaction, errorConfig);
        } else {
          await command.execute(bot, interaction, errorConfig);
        }
      } else if (interaction.isButton()) {
        // Button interaction
        const button = bot.buttonTriggers.find(({ customId }) => customId === interaction.customId);

        if (button === undefined) return;

        if (TypeGuards.isGuildOnlyBotButton(button)) {
          if (!TypeGuards.isGuildRepliableInteraction(interaction)) {
            throw new MethodNotAllowedError('This button is only available in servers.');
          }

          const { channel, client } = interaction;
          if (
            button.botHasManageRolePermission === true &&
            BotCheckers.isUserHasManageRolePermissionInChannel(client.user, channel) === false
          ) {
            throw new ForbiddenError(
              'The bot does not have the `Manage Roles` permission in this server.\n' +
                'Please try again after giving the bot this permission.',
            );
          }

          if (
            button.userHasManageRolePermission === true &&
            BotCheckers.isUserHasManageRolePermissionInChannel(interaction.user, channel) === false
          ) {
            throw new ForbiddenError(
              'You do not have the `Manage Roles` permission in this server to use this interaction.',
            );
          }

          await button.execute(bot, interaction, errorConfig);
        } else {
          await button.execute(bot, interaction, errorConfig);
        }
      }
    } catch (error) {
      console.error(error);
      const { activeInteraction, followUp } = errorConfig;

      let errorMessage = 'There was an error while handling this interaction!';
      if (error instanceof CustomError) {
        errorMessage = error.message;
      }

      await activeInteraction.genericReply({ content: errorMessage, followUp });
    }
  }
}
