import dayjs from 'dayjs';
import { Embed, EmbedBuilder, Message, RepliableInteraction, User } from 'discord.js';

import { GuildDoc } from '../../models/guild.js';
import { MembershipRoleDoc } from '../../models/membership-role.js';
import { OAuthMembershipDoc, OCRMembershipDoc } from '../../models/membership.js';
import { YouTubeChannelDoc } from '../../models/youtube-channel.js';
import { OCRConstants } from '../../services/ocr/constants.js';
import { BotErrorConfig } from '../../types/bot.js';
import { YouTubeChannelInfo } from '../../types/common.js';
import { BadRequestError } from '../../utils/error.js';
import { BotCommonUtils } from '../utils/index.js';
import { BotActionRows } from './action-rows.js';

export class BotEmbeds {
  public static createAuthorTemplateEmbed(userData: User | string): EmbedBuilder {
    if (typeof userData !== 'string') {
      const { id, username, avatar } = BotCommonUtils.getUserMeta(userData);
      return new EmbedBuilder()
        .setAuthor({
          name: username,
          iconURL: avatar,
        })
        .setTimestamp()
        .setFooter({ text: `ID: ${id}` });
    } else {
      const id = userData;
      return new EmbedBuilder()
        .setAuthor({
          name: `User ID: ${id}`,
        })
        .setTimestamp()
        .setFooter({ text: `ID: ${id}` });
    }
  }

  public static createMembershipVerificationRequestSubmissionEmbed(
    user: User,
    role: Omit<MembershipRoleDoc, 'youTubeChannel'> & {
      youTubeChannel: YouTubeChannelDoc | null;
    },
    languageName: string,
    guildName: string,
    imageUrl: string,
  ): EmbedBuilder {
    return BotEmbeds.createAuthorTemplateEmbed(user)
      .setTitle('Membership Verification Request Submitted')
      .setDescription(
        'After I finished recognizing your picture, ' +
          'it will be sent to the moderators of the server for further verification.\n' +
          'You will get a message when your role is applied.',
      )
      .addFields([
        {
          name: 'Membership Role',
          value: `<@&${role._id}>`,
          inline: true,
        },
        {
          name: 'Language',
          value: languageName,
          inline: true,
        },
        {
          name: 'Discord Server',
          value: guildName,
          inline: true,
        },
      ])
      .setImage(imageUrl)
      .setColor(role.color);
  }

  public static createOAuthMembershipEmbed(user: User, membershipRoleId: string): EmbedBuilder {
    return BotEmbeds.createAuthorTemplateEmbed(user)
      .setTitle('New OAuth Membership')
      .addFields([
        {
          name: 'Membership Role',
          value: `<@&${membershipRoleId}>`,
          inline: true,
        },
      ])
      .setColor('#57F287');
  }

  public static createMembershipVerificationRequestEmbed(
    user: User,
    date: {
      year: number | null;
      month: number | null;
      day: number | null;
    },
    roleId: string,
    langCode: string,
    imageUrl: string,
  ): EmbedBuilder {
    const { year, month, day } = date;

    return BotEmbeds.createAuthorTemplateEmbed(user)
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
            OCRConstants.supportedLanguages.find(({ code }) => code === langCode)?.name ?? langCode,
          inline: true,
        },
      ])
      .setImage(imageUrl)
      .setColor('#1DA0F2');
  }

  public static async parseMembershipVerificationRequestEmbed(
    interaction: RepliableInteraction & {
      message: Message;
    },
    infoEmbed: Embed | null,
    errorConfig: BotErrorConfig,
  ): Promise<{
    infoEmbed: Embed;
    userId: string;
    createdAt: dayjs.Dayjs;
    expireAt: dayjs.Dayjs | null;
    roleId: string;
  }> {
    const throwParseError = async () => {
      const invalidActionRow = BotActionRows.createDisabledInvalidActionRow();
      await interaction.message.edit({
        components: [invalidActionRow],
      });

      errorConfig.followUp = true;
      throw new BadRequestError('Failed to retrieve membership verification request embed.');
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
      infoEmbed.fields
        .find(({ name }) => name === 'Membership Role')
        ?.value?.match(roleRegex)?.[1] ?? null;
    if (roleId === null) return await throwParseError();

    return { infoEmbed, userId, createdAt, expireAt, roleId };
  }

  public static createManualMembershipAssignmentEmbed(
    user: User,
    expireAt: dayjs.Dayjs,
    roleId: string,
    moderatorId: string,
  ): EmbedBuilder {
    return BotEmbeds.createAuthorTemplateEmbed(user)
      .setTitle('✅ Manual Membership Assignment')
      .addFields([
        {
          name: 'Expiration Date',
          value: expireAt.format('YYYY/MM/DD'),
          inline: true,
        },
        {
          name: 'Membership Role',
          value: `<@&${roleId}>`,
          inline: true,
        },
        {
          name: 'Assigned By',
          value: `<@${moderatorId}>`,
          inline: true,
        },
      ])
      .setColor('#57F287');
  }

  public static createManualMembershipRemovalEmbed(
    userData: User | string,
    roleId: string,
    moderatorId: string,
  ): EmbedBuilder {
    return BotEmbeds.createAuthorTemplateEmbed(userData)
      .setTitle(`❌ Manual Membership Removal`)
      .addFields([
        {
          name: 'Membership Role',
          value: `<@&${roleId}>`,
          inline: true,
        },
        {
          name: 'Removed By',
          value: `<@${moderatorId}>`,
          inline: true,
        },
      ])
      .setColor('#ED4245');
  }

  public static createYouTubeChannelEmbed(
    user: User,
    channelInfo: YouTubeChannelInfo,
  ): EmbedBuilder {
    return BotEmbeds.createAuthorTemplateEmbed(user)
      .setTitle(channelInfo.title)
      .setDescription(channelInfo.description)
      .setURL(`https://www.youtube.com/channel/${channelInfo.id}`)
      .setThumbnail(channelInfo.thumbnail)
      .addFields([
        {
          name: 'Channel ID',
          value: channelInfo.id,
          inline: true,
        },
        {
          name: 'Custom URL',
          value: `[${channelInfo.customUrl}](https://www.youtube.com/${channelInfo.customUrl})`,
          inline: true,
        },
      ])
      .setColor('Random');
  }

  public static createMembershipStatusEmbed(
    user: User,
    ocrMembershipDocs: OCRMembershipDoc[],
    oauthMembershipDocs: OAuthMembershipDoc[],
  ): EmbedBuilder {
    return BotEmbeds.createAuthorTemplateEmbed(user)
      .setTitle(`Membership Status`)
      .addFields([
        {
          name: 'OCR Membership',
          value:
            ocrMembershipDocs.length === 0
              ? 'None'
              : ocrMembershipDocs
                  .map(
                    (ocrMembershipDoc) =>
                      `<@${ocrMembershipDoc.user}> (${dayjs
                        .utc(ocrMembershipDoc.billingDate)
                        .format('YYYY/MM/DD')})`,
                  )
                  .join('\n'),
        },
        {
          name: 'OAuth Membership',
          value:
            oauthMembershipDocs.length === 0
              ? 'None'
              : oauthMembershipDocs
                  .map((oauthMembershipDoc) => `<@${oauthMembershipDoc.user}>`)
                  .join('\n'),
          inline: true,
        },
      ]);
  }

  public static createOCRMembershipListEmbed(
    ocrMembershipDocs: OCRMembershipDoc[],
    membershipRoleDoc: Omit<MembershipRoleDoc, 'youTubeChannel'> & {
      youTubeChannel: YouTubeChannelDoc | null;
    },
    pageIndex: number,
  ): EmbedBuilder {
    const pageCount = ocrMembershipDocs.length === 0 ? 1 : Math.ceil(ocrMembershipDocs.length / 10);
    const partialOcrMembershipDocs = ocrMembershipDocs.slice(pageIndex * 10, (pageIndex + 1) * 10);

    return new EmbedBuilder()
      .setTitle('OCR Membership')
      .addFields([
        {
          name: 'Count',
          value: ocrMembershipDocs.length.toString(),
          inline: true,
        },
        {
          name: 'Membership Role',
          value: `<@&${membershipRoleDoc._id}>`,
          inline: true,
        },
        {
          name: 'YouTube Channel',
          value: `${membershipRoleDoc.youTubeChannel?.title ?? '[Unknown Channel]'}`,
          inline: true,
        },
        {
          name: 'Member',
          value:
            partialOcrMembershipDocs.length === 0
              ? 'None'
              : partialOcrMembershipDocs
                  .map((ocrMembershipDoc) => `<@${ocrMembershipDoc.user}>`)
                  .join('\n'),
          inline: true,
        },
        {
          name: 'Next Billing Date',
          value:
            partialOcrMembershipDocs.length === 0
              ? 'None'
              : partialOcrMembershipDocs
                  .map((ocrMembershipDoc) =>
                    dayjs.utc(ocrMembershipDoc.billingDate).format('YYYY/MM/DD'),
                  )
                  .join('\n'),
          inline: true,
        },
      ])
      .setFooter({
        text: `Page: ${pageIndex}/${pageCount}`,
      });
  }

  public static createOAuthMembershipListEmbed(
    oauthMembershipDocs: OAuthMembershipDoc[],
    membershipRoleDoc: Omit<MembershipRoleDoc, 'youTubeChannel'> & {
      youTubeChannel: YouTubeChannelDoc | null;
    },
    pageIndex: number,
  ): EmbedBuilder {
    const pageCount =
      oauthMembershipDocs.length === 0 ? 1 : Math.ceil(oauthMembershipDocs.length / 20);
    const partialOauthMembershipDocs = oauthMembershipDocs.slice(
      pageIndex * 20,
      (pageIndex + 1) * 20,
    );

    return new EmbedBuilder()
      .setTitle('OAuth Membership')
      .addFields([
        {
          name: 'Count',
          value: oauthMembershipDocs.length.toString(),
          inline: true,
        },
        {
          name: 'Membership Role',
          value: `<@&${membershipRoleDoc._id}>`,
          inline: true,
        },
        {
          name: 'YouTube Channel',
          value: `${membershipRoleDoc.youTubeChannel?.title ?? '[Unknown Channel]'}`,
          inline: true,
        },
        {
          name: 'Member',
          value:
            partialOauthMembershipDocs.length === 0
              ? 'None'
              : partialOauthMembershipDocs
                  .slice(0, 10)
                  .map((oauthMembershipDoc) => `<@${oauthMembershipDoc.user}>`)
                  .join('\n'),
          inline: true,
        },
        ...(partialOauthMembershipDocs.length > 10
          ? [
              {
                name: 'Member',
                value: partialOauthMembershipDocs
                  .slice(10, 20)
                  .map((oauthMembershipDoc) => `<@${oauthMembershipDoc.user}>`)
                  .join('\n'),
                inline: true,
              },
            ]
          : []),
      ])
      .setFooter({
        text: `Page: ${pageIndex + 1}/${pageCount}`,
      });
  }

  public static createGuildSettingsEmbed(
    user: User,
    guildConfig: GuildDoc,
    membershipRoleDocs: (Omit<MembershipRoleDoc, 'youTubeChannel'> & {
      youTubeChannel: YouTubeChannelDoc | null;
    })[],
  ): EmbedBuilder {
    return BotEmbeds.createAuthorTemplateEmbed(user)
      .setTitle('Guild Settings')
      .setThumbnail(guildConfig.icon)
      .addFields([
        {
          name: 'Guild name',
          value: guildConfig.name,
          inline: true,
        },
        {
          name: 'Guild ID',
          value: guildConfig._id,
          inline: true,
        },
        {
          name: 'Log channel',
          value: guildConfig.logChannel !== null ? `<#${guildConfig.logChannel}>` : 'None',
        },
        {
          name: 'Membership Roles',
          value:
            membershipRoleDocs.length > 0
              ? membershipRoleDocs
                  .map(
                    ({ _id: membershipRoleId, youTubeChannel }) =>
                      `<@&${membershipRoleId}> - ${
                        youTubeChannel !== null
                          ? `[${youTubeChannel.title}](https://www.youtube.com/channel/${youTubeChannel._id}) ([${youTubeChannel.customUrl}](https://www.youtube.com/${youTubeChannel.customUrl}))`
                          : '[Unknown Channel]'
                      }`,
                  )
                  .join('\n')
              : 'None',
        },
      ])
      .setColor('Random');
  }
}
