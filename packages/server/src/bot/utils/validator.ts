import dayjs from 'dayjs';
import { Guild, PermissionFlagsBits, TextChannel } from 'discord.js';

import { BadRequestError, CustomBotError, CustomError } from '../../libs/error.js';
import GuildCollection, { GuildDoc } from '../../models/guild.js';
import MembershipRoleCollection from '../../models/membership-role.js';
import MembershipCollection from '../../models/membership.js';
import { YouTubeChannelDoc } from '../../models/youtube-channel.js';
import client from '../index.js';

class Validator {
  private errorClass: typeof CustomError;

  constructor(errorClass: typeof CustomError) {
    this.errorClass = errorClass;
  }

  setError(errorClass: typeof CustomError) {
    this.errorClass = errorClass;
  }

  async requireGuild(guildId: string) {
    try {
      return await client.guilds.fetch({ guild: guildId, force: true });
    } catch (error) {
      console.error(error);
    }
    throw new this.errorClass(`The server with ID: ${guildId} does not exist.`);
  }

  async requireGuildMember(guild: Guild, userId: string) {
    try {
      return await guild.members.fetch({ user: userId, force: true });
    } catch (error) {
      console.error(error);
    }
    throw new this.errorClass(`The user <@${userId}> is not a member of the server.`);
  }

  async requireRole(guild: Guild, roleId: string) {
    try {
      const role = await guild.roles.fetch(roleId, { force: true });
      if (role !== null) return role;
    } catch (error) {
      console.error(error);
    }
    throw new this.errorClass(`Failed to retrieve the role <@&${roleId}> from the server.`);
  }

  async requireGuildDocument(guildId: string) {
    return await GuildCollection.findById(guildId).orFail(
      new this.errorClass(`The server with ID: ${guildId} does not exist in the database.`),
    );
  }

  requireGuildDocumentHasLogChannel(guildDoc: GuildDoc) {
    if (guildDoc.logChannel === null) {
      throw new this.errorClass(
        `This server does not have a log channel.\n` +
          'A server moderator can set a log channel with `/set-log-channel`.',
      );
    }
    return guildDoc.logChannel;
  }

  async requireGuildHasLogChannel(guild: Guild, logChannelId: string) {
    const { user: botUser } = client;

    const logChannel = await guild.channels.fetch(logChannelId, { force: true });
    if (logChannel === null) {
      throw new this.errorClass(`The log channel <#${logChannelId}> does not exist.`);
    } else if (!(logChannel instanceof TextChannel)) {
      throw new this.errorClass(`The log channel <#${logChannel.id}> must be a text channel.`);
    } else if (
      !(logChannel.permissionsFor(botUser)?.has(PermissionFlagsBits.ViewChannel) ?? false)
    ) {
      throw new this.errorClass(
        `The bot does not have the permission to view <#${logChannel.id}>.`,
      );
    } else if (
      !(logChannel.permissionsFor(botUser)?.has(PermissionFlagsBits.SendMessages) ?? false)
    ) {
      throw new this.errorClass(
        `The bot does not have the permission to send messages in <#${logChannel.id}>.`,
      );
    }

    return logChannel;
  }

  async requireMembershipRoleDocumentWithYouTubeChannel(roleId: string) {
    return await MembershipRoleCollection.findById(roleId)
      .populate<{ youTubeChannel: YouTubeChannelDoc | null }>('youTubeChannel')
      .orFail(
        new this.errorClass(`The role <@&${roleId}> is not a membership role in the server.`),
      );
  }

  requireGivenDateNotTooFarInFuture(
    targetDate: dayjs.Dayjs | null,
    baseDate = dayjs(),
    limitDays = 60,
  ) {
    const reasonableTimeLimit = baseDate.add(limitDays, 'days');

    if (targetDate === null) {
      throw new this.errorClass(
        'The target date is invalid.\n' + 'Please set the correct date manually.',
      );
    } else if (targetDate.isAfter(reasonableTimeLimit)) {
      throw new this.errorClass(
        'The target date is too far in the future.\n' +
          `The target date (\`${targetDate.format(
            'YYYY/MM/DD',
          )}\`) must not be more than ${limitDays} days after the base date (\`${baseDate.format(
            'YYYY/MM/DD',
          )}\`).`,
      );
    }
    return targetDate;
  }

  async requireMembershipDocumentWithGivenMembershipRole(userId: string, membershipRoleId: string) {
    return await MembershipCollection.findOne({
      user: userId,
      membershipRole: membershipRoleId,
    }).orFail(
      new this.errorClass(
        `The member <@${userId}> does not have the membership role <@&${membershipRoleId}>.`,
      ),
    );
  }

  async requireManageableRole(guild: Guild, roleId: string) {
    const botMember = await guild.members.fetchMe({ force: true });
    if (roleId === guild.id) {
      // @everyone
      throw new this.errorClass(
        'You cannot manipulate @everyone role.\n' + 'Please try again with a valid role.',
      );
    } else if (botMember.roles.highest.comparePositionTo(roleId) <= 0) {
      throw new this.errorClass(
        `Due to the role hierarchy, the bot cannot manage the role <@&${roleId}>.\n` +
          `I can only manage a role whose order is lower than that of my highest role highest role <@&${botMember.roles.highest.id}>.`,
      );
    }
  }
}

export default Validator;

export const botValidator = new Validator(CustomBotError);

export const badRequestValidator = new Validator(BadRequestError);
