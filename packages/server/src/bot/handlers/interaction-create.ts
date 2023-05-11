import { CustomBotError } from '../../libs/error.js';
import DiscordBotConfig from '../config.js';
import { genericReply } from '../utils/common.js';
import CustomBotEventHandler from './index.js';

const interactionCreate = new CustomBotEventHandler<'interactionCreate'>({
  name: 'interactionCreate',
  execute: async (interaction) => {
    if (!interaction.isRepliable()) return;

    const errorConfig: CustomBotErrorConfig = {
      activeInteraction: interaction,
      followUp: false,
    };
    try {
      if (interaction.isChatInputCommand()) {
        // Slash command
        const command = DiscordBotConfig.allCommands.find(
          ({ data }) => data.name === interaction.commandName,
        );

        if (command === undefined) return;

        await command.execute(interaction, errorConfig);
      } else if (interaction.isButton()) {
        // Button interaction
        const button = DiscordBotConfig.buttons.find(
          ({ customId }) => customId === interaction.customId,
        );

        if (button === undefined) return;

        await button.execute(interaction, errorConfig);
      }
    } catch (error) {
      console.error(error);
      const { activeInteraction, followUp } = errorConfig;
      let errorMessage = 'There was an error while handling this interaction!';
      if (error instanceof CustomBotError) {
        errorMessage = error.message;
      }
      const reply = genericReply(activeInteraction);
      await reply({ content: errorMessage }, followUp);
    }
  },
});

export default interactionCreate;
