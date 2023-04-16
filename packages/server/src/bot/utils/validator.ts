import dayjs from 'dayjs';
import { Guild, PermissionFlagsBits, RepliableInteraction, TextChannel } from 'discord.js';

import GuildCollection, { GuildDoc } from '../../models/guild.js';
import MembershipRoleCollection from '../../models/membership-role.js';
import MembershipCollection from '../../models/membership.js';
import { YouTubeChannelDoc } from '../../models/youtube-channel.js';
import client from '../index.js';
import { CustomError } from './error.js';

export const requireGuildDocument = async (
  interaction: RepliableInteraction | null,
  guild: Guild,
) => {
  return await GuildCollection.findById(guild.id).orFail(
    new CustomError(
      `The server ${guild.name}(ID: ${guild.id}) does not exist in the database.`,
      interaction,
    ),
  );
};

export const requireGuildDocumentAllowOCR = (
  interaction: RepliableInteraction | null,
  guildDoc: GuildDoc,
) => {
  if (!guildDoc.allowedMembershipVerificationMethods.ocr) {
    throw new CustomError(
      `This server does not allow OCR mode.\n` +
        'A server moderator can enable OCR mode in `/settings`.',
      interaction,
    );
  }
};

export const requireGuildDocumentHasLogChannel = (
  interaction: RepliableInteraction | null,
  guildDoc: GuildDoc,
) => {
  console.log(guildDoc);
  if (!guildDoc.logChannel) {
    throw new CustomError(
      `This server does not have a log channel.\n` +
        'A server moderator can set a log channel with `/set-log-channel`.',
      interaction,
    );
  }
  return guildDoc.logChannel;
};

export const requireGuildHasLogChannel = async (
  interaction: RepliableInteraction | null,
  guild: Guild,
  logChannelId: string,
) => {
  const { user: botUser } = client;

  const logChannel = await guild.channels.fetch(logChannelId, { force: true });
  if (!logChannel) {
    throw new CustomError(`The log channel <#${logChannelId}> does not exist.`, interaction);
  } else if (!(logChannel instanceof TextChannel)) {
    throw new CustomError(
      `The log channel <#${logChannel.id}> must be a text channel.`,
      interaction,
    );
  } else if (!logChannel.permissionsFor(botUser)?.has(PermissionFlagsBits.ViewChannel)) {
    throw new CustomError(
      `The bot does not have the permission to view <#${logChannel.id}>.`,
      interaction,
    );
  } else if (!logChannel.permissionsFor(botUser)?.has(PermissionFlagsBits.SendMessages)) {
    throw new CustomError(
      `The bot does not have the permission to send messages in <#${logChannel.id}>.`,
      interaction,
    );
  }

  return logChannel;
};

export const requireMembershipRoleDocumentWithYouTubeChannel = async (
  interaction: RepliableInteraction | null,
  roleId: string,
) => {
  return await MembershipRoleCollection.findById(roleId)
    .populate<{ youTubeChannel: YouTubeChannelDoc }>('youTubeChannel')
    .orFail(
      new CustomError(
        `The role <@&${roleId}> is not a membership role in this server.\n` +
          'You can use `/settings` to see the list of membership roles in this server.',
        interaction,
      ),
    );
};

export const requireGivenDateNotTooFarInFuture = (
  interaction: RepliableInteraction | null,
  targetDate: dayjs.Dayjs | null,
  baseDate = dayjs(),
  limitDays = 60,
) => {
  const reasonableTimeLimit = baseDate.add(limitDays, 'days');

  if (!targetDate) {
    throw new CustomError(
      'The target date is invalid.\n' + 'Please set the correct date manually.',
      interaction,
    );
  } else if (targetDate.isAfter(reasonableTimeLimit)) {
    throw new CustomError(
      'The target date is too far in the future.\n' +
        `The target date (\`${targetDate.format(
          'YYYY/MM/DD',
        )}\`) must not be more than ${limitDays} days after the base date (\`${baseDate.format(
          'YYYY/MM/DD',
        )}\`).`,
      interaction,
    );
  }
  return targetDate;
};

export const requireGuildMember = async (
  interaction: RepliableInteraction | null,
  guild: Guild,
  userId: string,
) => {
  try {
    return await guild.members.fetch({ user: userId, force: true });
  } catch (error) {
    console.error(error);
  }
  throw new CustomError(`The user <@${userId}> is not a member of this server.`, interaction);
};

export const requireOCRMembershipDocumentWithGivenMembershipRole = async (
  interaction: RepliableInteraction | null,
  userId: string,
  membershipRoleId: string,
) => {
  return await MembershipCollection.findOne({
    type: 'ocr',
    user: userId,
    membershipRole: membershipRoleId,
  }).orFail(
    new CustomError(
      `The member <@${userId}> does not have the membership role <@&${membershipRoleId}>.`,
      interaction,
    ),
  );
};

export const requireManageableRole = async (
  interaction: RepliableInteraction | null,
  guild: Guild,
  roleId: string,
) => {
  const botMember = await guild.members.fetchMe({ force: true });
  if (roleId === guild.id) {
    // @everyone
    throw new CustomError(
      'You cannot manipulate @everyone role.\n' + 'Please try again with a valid role.',
      interaction,
    );
  } else if (botMember.roles.highest.comparePositionTo(roleId) <= 0) {
    throw new CustomError(
      `Due to the role hierarchy, the bot cannot manage the role <@&${roleId}>.\n` +
        `I can only manage a role whose order is lower than that of my highest role highest role <@&${botMember.roles.highest.id}>.`,
      interaction,
    );
  }
};
