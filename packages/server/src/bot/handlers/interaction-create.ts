import { RepliableInteraction } from 'discord.js';

import DiscordBotConfig from '../config.js';
import { genericReply } from '../utils/common.js';
import { CustomError } from '../utils/error.js';
import CustomBotEventHandler from './index.js';

const interactionCreate = new CustomBotEventHandler<'interactionCreate'>({
  name: 'interactionCreate',
  execute: async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        // Slash command
        const command = DiscordBotConfig.allCommands.find(
          ({ data }) => data.name === interaction.commandName,
        );

        if (!command) return;

        await command.execute(interaction);
      } else if (interaction.isButton()) {
        // Button interaction
        const button = DiscordBotConfig.buttons.find(
          ({ customId }) => customId === interaction.customId,
        );

        if (!button) return;

        await button.execute(interaction);
      }
    } catch (error) {
      let errorInteraction = interaction as RepliableInteraction;
      let errorMessage = 'There was an error while handling this interaction!';
      let followUp = false;
      if (error instanceof CustomError) {
        errorInteraction = error.interaction;
        errorMessage = error.message;
        followUp = error.followUp;
      } else {
        console.error(error);
      }
      const reply = genericReply(errorInteraction);
      await reply({ content: errorMessage }, followUp);
    }
  },
});

export default interactionCreate;
