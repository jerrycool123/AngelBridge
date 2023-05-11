import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import utc from 'dayjs/plugin/utc.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  Embed,
  EmbedBuilder,
  Message,
  RepliableInteraction,
} from 'discord.js';

import { CustomBotError } from '../../libs/error.js';
import { extractDate } from '../../libs/i18n.js';
import ocrWorker, { supportedOCRLanguages } from '../../libs/ocr.js';
import membershipAcceptButton from '../buttons/membership-accept.js';
import membershipModifyButton from '../buttons/membership-modify.js';
import membershipRejectButton from '../buttons/membership-reject.js';
import client from '../index.js';
import { createDisabledInvalidActionRow } from './common.js';
import { botValidator } from './validator.js';

dayjs.extend(utc);
dayjs.extend(customParseFormat);

export const recognizeMembership = async (
  guildId: string,
  languageCode: SupportedOCRLanguage['code'],
  user: {
    id: string;
    username: string;
    avatar: string;
  },
  url: string,
  roleId: string,
) => {
  const guild = await client.guilds.fetch(guildId);
  const guildDoc = await botValidator.requireGuildDocument(guild.id);
  const logChannelId = botValidator.requireGuildDocumentHasLogChannel(guildDoc);
  const logChannel = await botValidator.requireGuildHasLogChannel(guild, logChannelId);

  let text = await ocrWorker.recognize(languageCode, url);
  if (text === null) {
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
                ? `${year}/${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}`
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
};

export const parseMembershipVerificationRequestEmbed = async (
  interaction: RepliableInteraction & {
    message: Message;
  },
  infoEmbed: Embed | null,
  errorConfig: CustomBotErrorConfig,
): Promise<{
  infoEmbed: Embed;
  userId: string;
  createdAt: dayjs.Dayjs;
  expireAt: dayjs.Dayjs | null;
  roleId: string;
}> => {
  const throwParseError = async () => {
    await interaction.message.edit({
      components: [createDisabledInvalidActionRow()],
    });
    errorConfig.followUp = true;
    throw new CustomBotError('Failed to retrieve membership verification request embed.');
  };

  if (infoEmbed === null) return await throwParseError();

  const userId = infoEmbed.footer?.text.split('User ID: ')[1] ?? null;
  if (userId === null) return await throwParseError();

  const createdAtString = infoEmbed.timestamp ?? null;
  const createdAt = createdAtString !== null ? dayjs.utc(createdAtString) : null;
  if (createdAt === null) return await throwParseError();

  const expireAtString =
    infoEmbed.fields.find(({ name }) => name === 'Expiration Date')?.value ?? null;
  const rawExpireAt =
    expireAtString !== null ? dayjs.utc(expireAtString, 'YYYY/MM/DD', true) : null;
  const expireAt = rawExpireAt?.isValid() ?? false ? rawExpireAt : null;

  const roleRegex = /<@&(\d+)>/;
  const roleId =
    infoEmbed.fields.find(({ name }) => name === 'Membership Role')?.value?.match(roleRegex)?.[1] ??
    null;
  if (roleId === null) return await throwParseError();

  return { infoEmbed, userId, createdAt, expireAt, roleId };
};
