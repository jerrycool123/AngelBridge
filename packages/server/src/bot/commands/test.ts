import { SlashCommandBuilder } from 'discord.js';

import CustomBotCommand from './index.js';

const test = new CustomBotCommand({
  data: new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),
  async execute(interaction) {
    await interaction.reply({
      content: 'Pong!',
      ephemeral: true,
    });
  },
});

export default test;
