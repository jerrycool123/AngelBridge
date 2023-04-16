import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import utc from 'dayjs/plugin/utc.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  Embed,
  EmbedBuilder,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';

import membershipAcceptButton from '../bot/buttons/membership-accept.js';
import membershipModifyButton from '../bot/buttons/membership-modify.js';
import membershipRejectButton from '../bot/buttons/membership-reject.js';
import client from '../bot/index.js';
import { createDisabledInvalidActionRow } from '../bot/utils/common.js';
import { CustomError } from '../bot/utils/error.js';
import GuildCollection from '../models/guild.js';
import { extractDate } from './i18n.js';
import ocrWorker, { supportedOCRLanguages } from './ocr.js';

dayjs.extend(utc);
dayjs.extend(customParseFormat);

export const recognizeMembership =
  (
    guildId: string,
    languageCode: SupportedOCRLanguage['code'],
    user: {
      id: string;
      username: string;
      avatar: string;
    },
    url: string,
    roleId: string,
  ) =>
  async () => {
    try {
      const guildDoc = await GuildCollection.findById(guildId);
      if (!guildDoc) {
        throw new Error(`Guild ID ${guildDoc} does not exist in the database`);
      } else if (!guildDoc.allowedMembershipVerificationMethods.ocr) {
        throw new Error(
          `Guild ${guildDoc.name}(ID:${guildDoc._id}) does not allow OCR verification`,
        );
      } else if (!guildDoc.logChannel) {
        throw new Error(`Guild ${guildDoc.name}(ID:${guildDoc._id}) does not have a log channel`);
      }
      const guild = await client.guilds.fetch(guildId);
      const logChannel = await guild.channels.fetch(guildDoc.logChannel, { force: true });
      if (!logChannel) {
        throw new Error(
          `The log channel ID ${guildDoc.logChannel} in guild ${guild.name}(ID: ${guild.id}) does not exist.`,
        );
      } else if (!(logChannel instanceof TextChannel)) {
        throw new Error(`The log channel ${logChannel.name} must be a text channel.`);
      } else if (!logChannel.permissionsFor(client.user)?.has(PermissionFlagsBits.ViewChannel)) {
        throw new Error(
          `The bot does not have the permission to view #${logChannel.name}(ID: ${logChannel.id}).`,
        );
      } else if (!logChannel.permissionsFor(client.user)?.has(PermissionFlagsBits.SendMessages)) {
        throw new Error(
          `The bot does not have the permission to send messages in #${logChannel.name}(ID: ${logChannel.id}).`,
        );
      }
      let text = await ocrWorker.recognize(languageCode, url);
      if (!text) {
        throw new Error('The OCR worker failed to recognize the text.');
      }
      // post-process the text
      // replace full-width characters with half-width characters
      text = text.replace(/[\uff01-\uff5e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
      // replace small form variant colon
      text = text.replace(/\ufe55/g, ':');
      // replace enclosed alphanumeric characters with their corresponding numbers
      text = text.replace(/[\u2460-\u2468]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x245f));
      text = text.replace(/[\u2469-\u2473]/g, (c) => (c.charCodeAt(0) - 0x245f).toString());

      const { year, month, day } = extractDate(text, languageCode);

      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        membershipAcceptButton.data,
        membershipRejectButton.data,
        membershipModifyButton.data,
      );
      await logChannel.send({
        components: [actionRow],
        embeds: [
          new EmbedBuilder()
            .setAuthor({
              name: user.username,
              iconURL: user.avatar,
            })
            .setTitle('Membership Verification Request')
            .addFields([
              {
                name: 'Expiration Date',
                value:
                  year !== null && month !== null && day !== null
                    ? `${year}/${month.toString().padStart(2, '0')}/${day
                        .toString()
                        .padStart(2, '0')}`
                    : '**Not Recognized**',
                inline: true,
              },
              {
                name: 'Membership Role',
                value: `<@&${roleId}>`,
                inline: true,
              },
              {
                name: 'Language',
                value:
                  supportedOCRLanguages.find(({ code }) => code === languageCode)?.language ??
                  languageCode,
                inline: true,
              },
            ])
            .setImage(url)
            .setTimestamp()
            .setColor('#1DA0F2')
            .setFooter({ text: `User ID: ${user.id}` }),
        ],
      });
    } catch (error) {
      console.log(error);
    }
  };

export const replyInvalidMembershipVerificationRequest = async (
  interaction: ButtonInteraction,
  content = 'Failed to retrieve membership verification request embed.',
) => {
  const actionRow = createDisabledInvalidActionRow();
  await interaction.message.edit({
    components: [actionRow],
  });
  throw new CustomError(content, interaction);
};

export const parseMembershipVerificationRequestEmbed = (
  infoEmbed: Embed | null,
): {
  infoEmbed: Embed;
  userId: string;
  createdAt: dayjs.Dayjs;
  expireAt: dayjs.Dayjs | null;
  roleId: string;
} | null => {
  if (!infoEmbed) return null;

  const userId = infoEmbed.footer?.text.split('User ID: ')[1] ?? null;
  if (!userId) return null;

  const createdAtString = infoEmbed.timestamp ?? null;
  const createdAt = createdAtString ? dayjs.utc(createdAtString) : null;
  if (!createdAt) return null;

  const expireAtString =
    infoEmbed.fields.find(({ name }) => name === 'Expiration Date')?.value ?? null;
  const rawExpireAt = expireAtString ? dayjs.utc(expireAtString, 'YYYY/MM/DD', true) : null;
  const expireAt = rawExpireAt?.isValid() ? rawExpireAt : null;

  const roleRegex = /<@&(\d+)>/;
  const roleId =
    infoEmbed.fields.find(({ name }) => name === 'Membership Role')?.value?.match(roleRegex)?.[1] ??
    null;
  if (!roleId) return null;

  return { infoEmbed, userId, createdAt, expireAt, roleId };
};
