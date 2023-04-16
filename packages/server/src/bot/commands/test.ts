import { SlashCommandBuilder } from 'discord.js';

import { genericReply } from '../utils/common.js';
import { useGuildOnly } from '../utils/validator.js';
import CustomBotCommand from './index.js';

const test = new CustomBotCommand({
  data: new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),
  execute: useGuildOnly(async (interaction) => {
    await interaction.deferReply({ ephemeral: true });
    const reply = genericReply(interaction);
    await reply({
      content: 'Pong!',
    });
  }),
});

export default test;
