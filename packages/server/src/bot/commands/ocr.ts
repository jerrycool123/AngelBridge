import { SlashCommandBuilder } from 'discord.js';

import CustomBotCommand from '.';
import { genericOption } from '../../libs/discord-util';
import ocrWorker from '../../libs/ocr';

const ocr = new CustomBotCommand({
  data: new SlashCommandBuilder()
    .setName('ocr')
    .setDescription('OCR')
    .setDMPermission(true)
    .addAttachmentOption(genericOption('picture', 'Picture to OCR', true)),
  async execute(interaction) {
    const { options } = interaction;

    await interaction.deferReply({ ephemeral: true });

    const picture = options.getAttachment('picture', true);
    if (!picture.contentType?.startsWith('image/')) {
      await interaction.editReply({
        content: 'Please provide an image file.',
      });
      return;
    }

    const text = await ocrWorker.recognize(picture.url);
    await interaction.editReply({
      content: text,
    });
  },
});

export default ocr;
