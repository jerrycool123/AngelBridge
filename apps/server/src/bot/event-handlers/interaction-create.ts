import { ClientEvents } from 'discord.js';

import { BotChecker } from '../../checkers/bot.js';
import { CustomError, ForbiddenError, MethodNotAllowedError } from '../../libs/error.js';
import { TypeGuards } from '../../libs/type-guards.js';
import { Bot, BotErrorConfig, BotEventHandler } from '../../types/bot.js';
import { genericReply } from '../utils/common.js';

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
        const command = bot.commands.find(({ data }) => data.name === interaction.commandName);

        if (command === undefined) return;

        if (TypeGuards.isGuildOnlyBotCommand(command)) {
          if (!TypeGuards.isGuildRepliableInteraction(interaction)) {
            throw new MethodNotAllowedError('This command is only available in servers.');
          }

          const { channel, client } = interaction;
          if (
            command.botHasManageRolePermission === true &&
            BotChecker.isUserHasManageRolePermissionInChannel(client.user, channel) === false
          ) {
            throw new ForbiddenError(
              'The bot does not have the `Manage Roles` permission in this server.\n' +
                'Please try again after giving the bot this permission.',
            );
          }

          await command.execute(interaction, errorConfig);
        } else {
          await command.execute(interaction, errorConfig);
        }
      } else if (interaction.isButton()) {
        // Button interaction
        const button = bot.buttons.find(({ customId }) => customId === interaction.customId);

        if (button === undefined) return;

        if (TypeGuards.isGuildOnlyBotButton(button)) {
          if (!TypeGuards.isGuildRepliableInteraction(interaction)) {
            throw new MethodNotAllowedError('This button is only available in servers.');
          }

          const { channel, client } = interaction;
          if (
            button.botHasManageRolePermission === true &&
            BotChecker.isUserHasManageRolePermissionInChannel(client.user, channel) === false
          ) {
            throw new ForbiddenError(
              'The bot does not have the `Manage Roles` permission in this server.\n' +
                'Please try again after giving the bot this permission.',
            );
          }

          if (
            button.userHasManageRolePermission === true &&
            BotChecker.isUserHasManageRolePermissionInChannel(interaction.user, channel) === false
          ) {
            throw new ForbiddenError(
              'You do not have the `Manage Roles` permission in this server to use this interaction.',
            );
          }

          await button.execute(interaction, errorConfig);
        } else {
          await button.execute(interaction, errorConfig);
        }
      }
    } catch (error) {
      console.error(error);
      const { activeInteraction, followUp } = errorConfig;
      let errorMessage = 'There was an error while handling this interaction!';
      if (error instanceof CustomError) {
        errorMessage = error.message;
      }
      const reply = genericReply(activeInteraction);
      await reply({ content: errorMessage }, followUp);
    }
  }
}
