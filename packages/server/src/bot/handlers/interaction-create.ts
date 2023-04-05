import DiscordBotConfig from '../config.js';
import CustomBotEventHandler from './index.js';

const interactionCreate = new CustomBotEventHandler<'interactionCreate'>({
  name: 'interactionCreate',
  execute: async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = DiscordBotConfig.allCommands.find(
      ({ data }) => data.name === interaction.commandName,
    );

    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: 'There was an error while executing this command!',
        ephemeral: true,
      });
    }
  },
});

export default interactionCreate;
