import { Guild, GuildChannel, PermissionFlagsBits, TextChannel, User } from 'discord.js';

import { bot } from '../bot/index.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../libs/error.js';

export class BotChecker {
  public static isUserHasManageRolePermissionInChannel(user: User, channel: GuildChannel): boolean {
    return channel.permissionsFor(user)?.has(PermissionFlagsBits.ManageRoles) ?? false;
  }

  public static async requireSelfMember(guild: Guild, force = true) {
    try {
      return await guild.members.fetchMe({ force });
    } catch (error) {
      console.error(error);
    }
    throw new NotFoundError(`The bot is not a member of the server.`);
  }

  public static async requireUser(userId: string, force = true) {
    try {
      return await bot.client.users.fetch(userId, { force });
    } catch (error) {
      console.error(error);
    }
    throw new NotFoundError(`The user with ID: ${userId} does not exist.`);
  }

  public static async requireGuild(guildId: string, force = true) {
    try {
      return await bot.client.guilds.fetch({ guild: guildId, force });
    } catch (error) {
      console.error(error);
    }
    throw new NotFoundError(`The server with ID: ${guildId} does not exist.`);
  }

  public static async requireGuildOwner(guild: Guild, force = true) {
    try {
      return await guild.fetchOwner({ force });
    } catch (error) {
      console.error(error);
    }
    throw new NotFoundError(`The owner of the server <@${guild.id}> does not exist.`);
  }

  public static async requireGuildMember(guild: Guild, userId: string, force = true) {
    try {
      return await guild.members.fetch({ user: userId, force });
    } catch (error) {
      console.error(error);
    }
    throw new NotFoundError(`The user <@${userId}> is not a member of the server.`);
  }

  public static async requireRole(guild: Guild, roleId: string, force = true) {
    try {
      const role = await guild.roles.fetch(roleId, { force });
      if (role !== null) return role;
    } catch (error) {
      console.error(error);
    }
    throw new NotFoundError(`Failed to retrieve the role <@&${roleId}> from the server.`);
  }

  public static async requireGuildHasLogChannel(guild: Guild, logChannelId: string, force = true) {
    const { user: botUser } = bot.client;

    const logChannel = await guild.channels.fetch(logChannelId, { force });
    if (botUser === null) {
      throw new NotFoundError(`The bot is not ready.`);
    } else if (logChannel === null) {
      throw new NotFoundError(`The log channel <#${logChannelId}> does not exist.`);
    } else if (!(logChannel instanceof TextChannel)) {
      throw new BadRequestError(`The log channel <#${logChannel.id}> must be a text channel.`);
    } else if (
      !(logChannel.permissionsFor(botUser)?.has(PermissionFlagsBits.ViewChannel) ?? false)
    ) {
      throw new ForbiddenError(`The bot does not have the permission to view <#${logChannel.id}>.`);
    } else if (
      !(logChannel.permissionsFor(botUser)?.has(PermissionFlagsBits.SendMessages) ?? false)
    ) {
      throw new ForbiddenError(
        `The bot does not have the permission to send messages in <#${logChannel.id}>.`,
      );
    }

    return logChannel;
  }

  public static async requireManageableRole(guild: Guild, roleId: string, force = true) {
    const botMember = await guild.members.fetchMe({ force });
    if (roleId === guild.id) {
      // @everyone
      throw new BadRequestError(
        'You cannot manipulate @everyone role.\n' + 'Please try again with a valid role.',
      );
    } else if (botMember.roles.highest.comparePositionTo(roleId) <= 0) {
      throw new ForbiddenError(
        `Due to the role hierarchy, the bot cannot manage the role <@&${roleId}>.\n` +
          `I can only manage a role whose order is lower than that of my highest role highest role <@&${botMember.roles.highest.id}>.`,
      );
    }
  }
}
