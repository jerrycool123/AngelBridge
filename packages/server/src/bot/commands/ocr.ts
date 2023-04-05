import { SlashCommandBuilder } from 'discord.js';

import { genericOption } from '../../libs/discord-util.js';
import { recognizeMembership } from '../../libs/membership.js';
import ocrWorker from '../../libs/ocr.js';
import CustomBotCommand from './index.js';

const ocr = new CustomBotCommand({
  data: new SlashCommandBuilder()
    .setName('ocr')
    .setDescription('OCR')
    .setDMPermission(true)
    .addAttachmentOption(genericOption('picture', 'Picture to OCR', true)),
  async execute(interaction) {
    const { guild, user, options } = interaction;
    if (!guild) {
      await interaction.reply({
        content:
          'This command can only be used in a guild.\nHowever, we are developing a DM version of this command. Stay tuned!',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const picture = options.getAttachment('picture', true);
    if (!picture.contentType?.startsWith('image/')) {
      await interaction.editReply({
        content: 'Please provide an image file.',
      });
      return;
    }

    ocrWorker.addJob(
      recognizeMembership(
        guild.id,
        'jpn',
        {
          id: user.id,
          username: `${user.username}#${user.discriminator}`,
          avatar: user.displayAvatarURL(),
        },
        picture.url,
        '0',
      ),
    );
    await interaction.editReply({
      content: 'Your OCR job has been created.',
    });
  },
});

export default ocr;
