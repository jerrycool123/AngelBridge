import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import utc from 'dayjs/plugin/utc.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CacheType,
  EmbedBuilder,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import CommonChecker from '../../checkers/common.js';
import { BadRequestError, RequestTimeoutError } from '../../libs/error.js';
import { parseMembershipVerificationRequestEmbed } from '../utils/membership.js';
import { useGuildOnly, useUserWithManageRolePermission } from '../utils/middleware.js';
import CustomButton from './index.js';

dayjs.extend(utc);
dayjs.extend(customParseFormat);

const membershipModifyButton = new CustomButton({
  customId: 'membership-modify',
  data: new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel('Modify Date'),
  execute: useGuildOnly(
    useUserWithManageRolePermission(async (interaction, errorConfig) => {
      errorConfig.followUp = true;
      const { user: moderator } = interaction;

      // Create modify modal
      const modifyModal = new ModalBuilder()
        .setCustomId('membership-modify-modal')
        .setTitle('Modify Expiration Date')
        .addComponents(
          new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('membership-modify-date-input')
              .setLabel('Correct Date (must be YYYY/MM/DD)')
              .setPlaceholder('YYYY/MM/DD')
              .setStyle(TextInputStyle.Short)
              .setRequired(true),
          ),
        );
      await interaction.showModal(modifyModal);

      // Parse embed
      const { infoEmbed, createdAt } = await parseMembershipVerificationRequestEmbed(
        interaction,
        interaction.message.embeds[0] ?? null,
        errorConfig,
      );

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
      if (modalSubmitInteraction === null) {
        throw new RequestTimeoutError('Timed out. Please try again.');
      }

      // Acknowledge the modal
      await modalSubmitInteraction.deferUpdate();

      // Parse modified date
      const expireAtString = modalSubmitInteraction.fields.getTextInputValue(
        'membership-modify-date-input',
      );
      const newExpireAt = dayjs.utc(expireAtString, 'YYYY/MM/DD', true);
      if (!newExpireAt.isValid()) {
        throw new BadRequestError(
          'Invalid date. The date must be in YYYY/MM/DD format. Please try again.',
        );
      }

      // Check if the modified date is too far in the future
      CommonChecker.requireGivenDateNotTooFarInFuture(newExpireAt, createdAt);

      // Modify the date
      let apiEmbedFields = infoEmbed.data.fields ?? [];
      const recognizedDateFieldIndex =
        apiEmbedFields.findIndex(({ name }) => name === 'Expiration Date') ?? -1;
      const modifiedByFieldIndex =
        apiEmbedFields.findIndex(({ name }) => name === 'Modified By') ?? -1;
      if (recognizedDateFieldIndex === -1) {
        apiEmbedFields.push({
          name: 'Expiration Date',
          value: newExpireAt.format('YYYY/MM/DD'),
          inline: true,
        });
      } else {
        apiEmbedFields = [
          ...apiEmbedFields.slice(0, recognizedDateFieldIndex),
          {
            name: 'Expiration Date',
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
    }),
  ),
});

export default membershipModifyButton;
