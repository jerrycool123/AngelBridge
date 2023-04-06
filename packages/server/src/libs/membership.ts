import dayjs from 'dayjs';
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
import membershipRejectButton from '../bot/buttons/membership-reject.js';
import client from '../bot/index.js';
import Guild from '../models/guild.js';
import { createInvalidActionRow, generateRandomColorNumber } from './discord-util.js';
import { extractDate } from './i18n.js';
import ocrWorker, { supportedOCRLanguages } from './ocr.js';

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
      const dbGuild = await Guild.findById(guildId);
      if (!dbGuild) {
        throw new Error(`Guild ID ${dbGuild} does not exist in the database`);
      } else if (!dbGuild.allowedMembershipVerificationMethods.ocr) {
        throw new Error(`Guild ${dbGuild.name}(ID:${dbGuild._id}) does not allow OCR verification`);
      } else if (!dbGuild.logChannel) {
        throw new Error(`Guild ${dbGuild.name}(ID:${dbGuild._id}) does not have a log channel`);
      }
      const guild = await client.guilds.fetch(guildId);
      const logChannel = await guild.channels.fetch(dbGuild.logChannel, { force: true });
      if (!logChannel) {
        throw new Error(
          `The log channel ID ${dbGuild.logChannel} in guild ${guild.name}(ID: ${guild.id}) does not exist.`,
        );
      } else if (!(logChannel instanceof TextChannel)) {
        throw new Error(`The log channel ${logChannel.name} must be a text channel.`);
      } else if (
        !guild.members.me?.permissionsIn(logChannel).has(PermissionFlagsBits.ViewChannel)
      ) {
        throw new Error(
          `The bot does not have the permission to view #${logChannel.name}(ID: ${logChannel.id}).`,
        );
      } else if (
        !guild.members.me?.permissionsIn(logChannel).has(PermissionFlagsBits.SendMessages)
      ) {
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
                name: 'Recognized Date',
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
            .setColor(generateRandomColorNumber())
            .setFooter({ text: `User ID: ${user.id}` }),
        ],
      });
    } catch (error) {
      console.log(error);
    }
  };

export const replyInvalidRequest = async (
  interaction: ButtonInteraction,
  content = 'Failed to retrieve membership verification request embed.',
) => {
  const actionRow = createInvalidActionRow();
  await interaction.message.edit({
    components: [actionRow],
  });
  await interaction.reply({ content });
  return;
};

export const parseMembershipVerificationRequestEmbed = (
  infoEmbed: Embed | null,
): {
  userId: string;
  createdAt: dayjs.Dayjs;
  expireAt: dayjs.Dayjs;
  roleId: string;
} | null => {
  if (!infoEmbed) return null;

  const userId = infoEmbed.footer?.text.split('User ID: ')[1] ?? null;
  if (!userId) return null;

  const createdAtString = infoEmbed.timestamp ?? null;
  const createdAt = createdAtString ? dayjs(createdAtString) : null;
  if (!createdAt) return null;

  const expireAtString =
    infoEmbed.fields.find(({ name }) => name === 'Recognized Date')?.value ?? null;
  const expireAt = expireAtString ? dayjs(expireAtString, 'YYYY/MM/DD') : null;
  if (!expireAt?.isValid()) return null;

  const roleRegex = /<@&(\d+)>/;
  const roleId =
    infoEmbed.fields.find(({ name }) => name === 'Membership Role')?.value?.match(roleRegex)?.[1] ??
    null;
  if (!roleId) return null;

  return { userId, createdAt, expireAt, roleId };
};
