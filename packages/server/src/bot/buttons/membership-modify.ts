import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import utc from 'dayjs/plugin/utc.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CacheType,
  EmbedBuilder,
  GuildChannel,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import {
  parseMembershipVerificationRequestEmbed,
  replyInvalidRequest,
} from '../../libs/membership.js';
import DiscordBotConfig from '../config.js';
import CustomButton from './index.js';

dayjs.extend(utc);
dayjs.extend(customParseFormat);

const membershipModifyButton = new CustomButton({
  customId: 'membership-modify',
  data: new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel('Modify Date'),
  execute: async (interaction) => {
    const { guild, channel, user: moderator } = interaction;
    if (!guild || !channel || !(channel instanceof GuildChannel)) return;

    // Moderator permission check
    if (!channel.permissionsFor(moderator)?.has(DiscordBotConfig.moderatorPermissions)) {
      await interaction.reply({
        content: 'You do not have `Manage Roles` permission to accept membership requests.',
      });
      return;
    }

    // Create modify modal
    const modifyModal = new ModalBuilder()
      .setCustomId('membership-modify-modal')
      .setTitle('Modify Billing Date')
      .addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('membership-modify-date')
            .setLabel('Correct Date (must be YYYY/MM/DD)')
            .setPlaceholder('YYYY/MM/DD')
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        ),
      );
    await interaction.showModal(modifyModal);

    // Parse embed
    const parsedResult = parseMembershipVerificationRequestEmbed(
      interaction.message.embeds[0] ?? null,
    );
    if (!parsedResult) {
      return await replyInvalidRequest(interaction);
    }
    const { infoEmbed, createdAt } = parsedResult;

    // Receive correct date from the modal
    let modalSubmitInteraction: ModalSubmitInteraction<CacheType> | null = null;
    try {
      modalSubmitInteraction = await interaction.awaitModalSubmit({
        filter: (modalSubmitInteraction) =>
          moderator.id === modalSubmitInteraction.user.id &&
          modalSubmitInteraction.customId === 'membership-modify-modal',
        time: 60 * 1000,
      });
    } catch (error) {
      // Timeout
    }
    if (!modalSubmitInteraction) {
      await interaction.followUp({ content: 'Timed out. Please try again.', ephemeral: true });
      return;
    }

    // Acknowledge the modal
    await modalSubmitInteraction.deferUpdate();

    // Parse modified date
    const expireAtString =
      modalSubmitInteraction.fields.getTextInputValue('membership-modify-date');
    const newExpireAt = dayjs.utc(expireAtString, 'YYYY/MM/DD', true);
    if (!newExpireAt.isValid()) {
      await interaction.followUp({
        content: 'Invalid date. The date must be in YYYY/MM/DD format. Please try again.',
      });
      return;
    }

    // Check if the modified date is too far in the future
    const reasonableTimeLimit = createdAt.add(60, 'days');
    if (newExpireAt.isAfter(reasonableTimeLimit)) {
      await interaction.followUp({
        content:
          'The modified date is too far in the future.\n' +
          `The modified date (\`${newExpireAt.format(
            'YYYY/MM/DD',
          )}\`) must not be more than 60 days after the request was made (\`${createdAt.format(
            'YYYY/MM/DD',
          )}\`).`,
      });
      return;
    }

    // Modify the date
    let apiEmbedFields = infoEmbed.data.fields ?? [];
    const recognizedDateFieldIndex =
      apiEmbedFields.findIndex(({ name }) => name === 'Recognized Date') ?? -1;
    const modifiedByFieldIndex =
      apiEmbedFields.findIndex(({ name }) => name === 'Modified By') ?? -1;
    if (recognizedDateFieldIndex === -1) {
      apiEmbedFields.push({
        name: 'Recognized Date',
        value: newExpireAt.format('YYYY/MM/DD'),
        inline: true,
      });
    } else {
      apiEmbedFields = [
        ...apiEmbedFields.slice(0, recognizedDateFieldIndex),
        {
          name: 'Recognized Date',
          value: newExpireAt.format('YYYY/MM/DD'),
          inline: true,
        },
        ...apiEmbedFields.slice(recognizedDateFieldIndex + 1),
      ];
    }
    if (modifiedByFieldIndex === -1) {
      apiEmbedFields.push({
        name: 'Modified By',
        value: `<@${moderator.id}>`,
        inline: true,
      });
    } else {
      apiEmbedFields = [
        ...apiEmbedFields.slice(0, modifiedByFieldIndex),
        {
          name: 'Modified By',
          value: `<@${moderator.id}>`,
          inline: true,
        },
        ...apiEmbedFields.slice(modifiedByFieldIndex + 1),
      ];
    }
    await interaction.message.edit({
      embeds: [EmbedBuilder.from(infoEmbed.data).setFields(apiEmbedFields).setColor('#FEE75C')],
    });
  },
});

export default membershipModifyButton;
