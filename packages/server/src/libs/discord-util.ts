import { CommandInteraction, EmbedBuilder, PermissionFlagsBits, TextChannel } from 'discord.js';
import type { ApplicationCommandOptionBase } from 'discord.js';
import { Guild as DiscordGuild } from 'discord.js';

import client from '../bot';
import Guild from '../models/guild';
import ocrWorker, { supportedOCRLanguages } from './ocr';

export const replyGuildOnly = async (interaction: CommandInteraction) => {
  await interaction.reply({
    content: 'This command is unavailable in DM channels!',
    ephemeral: true,
  });
};

export const genericOption =
  <T extends ApplicationCommandOptionBase>(name: string, description: string, required = false) =>
  (option: T) =>
    option.setName(name).setDescription(description).setRequired(required);

export const generateRandomColorNumber = () => Math.floor(Math.random() * 16777215);

export const upsertGuildConfig = async (guild: DiscordGuild) => {
  return await Guild.findByIdAndUpdate(
    guild.id,
    {
      $set: {
        name: guild.name,
        icon: guild.iconURL(),
      },
      $setOnInsert: {
        _id: guild.id,
        allowedMembershipVerificationMethods: {
          oauth: false,
          ocr: true,
        },
      },
    },
    {
      upsert: true,
      new: true,
    },
  );
};

export const ocrAndPushToLogChannel =
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
      // replace spaces with empty string
      const lines = text.split('\n').map((line) => line.replace(/\s/g, ''));
      text = lines.join('\n');
      // TODO: extract date
      let year: number | null = null;
      let month: number | null = null;
      let day: number | null = null;
      if (languageCode === 'eng') {
        const regex =
          /Nextbillingdate:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{1,2}),(\d{4})/;
        for (const line of lines) {
          const match = line.match(regex);
          if (match) {
            const abbreviatedMonth = match[1];
            const monthMap: Record<string, number> = {
              Jan: 1,
              Feb: 2,
              Mar: 3,
              Apr: 4,
              May: 5,
              Jun: 6,
              Jul: 7,
              Aug: 8,
              Sep: 9,
              Oct: 10,
              Nov: 11,
              Dec: 12,
            };
            month = monthMap[abbreviatedMonth];
            [day, year] = match.slice(2, 4).map((s) => parseInt(s, 10));
            break;
          }
        }
      } else if (languageCode === 'chi_tra') {
        const regex = /帳單日期:(\d{4})年(\d{1,2})月(\d{1,2})日/;
        for (const line of lines) {
          const match = line.match(regex);
          if (match) {
            [year, month, day] = match.slice(1, 4).map((s) => parseInt(s, 10));
            break;
          }
        }
      } else if (languageCode === 'chi_sim') {
        const regex = /结算日期:(\d{4})年(\d{1,2})月(\d{1,2})日/;
        for (const line of lines) {
          const match = line.match(regex);
          if (match) {
            [year, month, day] = match.slice(1, 4).map((s) => parseInt(s, 10));
            break;
          }
        }
      } else if (languageCode === 'deu') {
        const regex = /NächstesAbrechnungsdatum:(\d{1,2})\.(\d{1,2})\.(\d{4})/;
        for (const line of lines) {
          const match = line.match(regex);
          if (match) {
            [day, month, year] = match.slice(1, 4).map((s) => parseInt(s, 10));
            break;
          }
        }
      } else if (languageCode === 'fil') {
        const regex =
          /Susunodnapetsangpagsingil:(Ene|Peb|Mar|Abr|Mayo|Hun|Hul|Ago|Set|Okt|Nob|Dis)(\d{1,2}),(\d{4})/;
        for (const line of lines) {
          const match = line.match(regex);
          if (match) {
            const abbreviatedMonth = match[1];
            const monthMap: Record<string, number> = {
              Ene: 1,
              Peb: 2,
              Mar: 3,
              Abr: 4,
              Mayo: 5,
              Hun: 6,
              Hul: 7,
              Ago: 8,
              Set: 9,
              Okt: 10,
              Nob: 11,
              Dis: 12,
            };
            month = monthMap[abbreviatedMonth];
            [day, year] = match.slice(2, 4).map((s) => parseInt(s, 10));
            break;
          }
        }
      } else if (languageCode === 'ind') {
        const regex =
          /Tanggalpenagihanberikutnya:(\d{1,2})(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des)(\d{4})/;
        for (const line of lines) {
          const match = line.match(regex);
          if (match) {
            const abbreviatedMonth = match[2];
            const monthMap: Record<string, number> = {
              Jan: 1,
              Feb: 2,
              Mar: 3,
              Apr: 4,
              Mei: 5,
              Jun: 6,
              Jul: 7,
              Agu: 8,
              Sep: 9,
              Okt: 10,
              Nov: 11,
              Des: 12,
            };
            month = monthMap[abbreviatedMonth];
            [day, , year] = match.slice(1, 4).map((s) => parseInt(s, 10));
            break;
          }
        }
      } else if (languageCode === 'jpn') {
        const regex = /次回請求日:(\d{4})\/(\d{2})\/(\d{2})/;
        for (const line of lines) {
          const match = line.match(regex);
          if (match) {
            [year, month, day] = match.slice(1, 4).map((s) => parseInt(s, 10));
            break;
          }
        }
      } else if (languageCode === 'kor') {
        const regex = /다음결제일:(\d{4})\.(\d{1,2})\.(\d{1,2})\./;
        for (const line of lines) {
          const match = line.match(regex);
          if (match) {
            [year, month, day] = match.slice(1, 4).map((s) => parseInt(s, 10));
            break;
          }
        }
      } else if (languageCode === 'msa') {
        const regex =
          /Tarikhpengebilanseterusnya:(\d{1,2})(Jan|Feb|Mac|Apr|Mei|Jun|Jul|Ogos|Sep|Okt|Nov|Dis)(\d{4})/;
        for (const line of lines) {
          const match = line.match(regex);
          if (match) {
            const abbreviatedMonth = match[2];
            const monthMap: Record<string, number> = {
              Jan: 1,
              Feb: 2,
              Mac: 3,
              Apr: 4,
              Mei: 5,
              Jun: 6,
              Jul: 7,
              Ogos: 8,
              Sep: 9,
              Okt: 10,
              Nov: 11,
              Dis: 12,
            };
            month = monthMap[abbreviatedMonth];
            [day, , year] = match.slice(1, 4).map((s) => parseInt(s, 10));
            break;
          }
        }
      } else if (languageCode === 'tha') {
        const regex =
          /เรียกเก็บเงินครั้งถัดไปในวันที่(\d{1,2})(ม.ค.|ก.พ.|มี.ค.|เม.ย.|พ.ค.|มิ.ย.|ก.ค.|ส.ค.|ก.ย.|ต.ค.|พ.ย.|ธ.ค.)(\d{4})/;
        for (const line of lines) {
          const match = line.match(regex);
          if (match) {
            const abbreviatedMonth = match[2];
            const monthMap: Record<string, number> = {
              'ม.ค.': 1,
              'ก.พ.': 2,
              'มี.ค.': 3,
              'เม.ย.': 4,
              'พ.ค.': 5,
              'มิ.ย.': 6,
              'ก.ค.': 7,
              'ส.ค.': 8,
              'ก.ย.': 9,
              'ต.ค.': 10,
              'พ.ย.': 11,
              'ธ.ค.': 12,
            };
            month = monthMap[abbreviatedMonth];
            [day, , year] = match.slice(1, 4).map((s) => parseInt(s, 10));
            break;
          }
        }
      } else if (languageCode === 'vie') {
        const regex = /Ngàythanhtoántiếptheo:(\d{1,2})thg(\d{1,2}),(\d{4})/;
        for (const line of lines) {
          const match = line.match(regex);
          if (match) {
            [day, month, year] = match.slice(1, 4).map((s) => parseInt(s, 10));
            break;
          }
        }
      }
      console.log(text);
      const message = await logChannel.send({
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
                    ? `${year}/${month}/${day}`
                    : '**Not Recognized**',
                inline: true,
              },
              {
                name: 'Membership Role',
                value: `<@&${roleId}>`,
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
      await message.react('✅');
      await message.react('📅');
      await message.react('❌');
    } catch (error) {
      console.log(error);
    }
  };
