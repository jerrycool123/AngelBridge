import { Guild, PermissionFlagsBits, TextChannel } from 'discord.js';

import client from '../bot/index.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../libs/error.js';

namespace BotChecker {
  export const requireSelfMember = async (guild: Guild) => {
    try {
      return await guild.members.fetchMe({ force: true });
    } catch (error) {
      console.error(error);
    }
    throw new NotFoundError(`The bot is not a member of the server.`);
  };

  export const requireUser = async (userId: string) => {
    try {
      return await client.users.fetch(userId, { force: true });
    } catch (error) {
      console.error(error);
    }
    throw new NotFoundError(`The user with ID: ${userId} does not exist.`);
  };

  export const requireGuild = async (guildId: string) => {
    try {
      return await client.guilds.fetch({ guild: guildId, force: true });
    } catch (error) {
      console.error(error);
    }
    throw new NotFoundError(`The server with ID: ${guildId} does not exist.`);
  };

  export const requireGuildOwner = async (guild: Guild) => {
    try {
      return await guild.fetchOwner({ force: true });
    } catch (error) {
      console.error(error);
    }
    throw new NotFoundError(`The owner of the server <@${guild.id}> does not exist.`);
  };

  export const requireGuildMember = async (guild: Guild, userId: string) => {
    try {
      return await guild.members.fetch({ user: userId, force: true });
    } catch (error) {
      console.error(error);
    }
    throw new NotFoundError(`The user <@${userId}> is not a member of the server.`);
  };

  export const requireRole = async (guild: Guild, roleId: string) => {
    try {
      const role = await guild.roles.fetch(roleId, { force: true });
      if (role !== null) return role;
    } catch (error) {
      console.error(error);
    }
    throw new NotFoundError(`Failed to retrieve the role <@&${roleId}> from the server.`);
  };

  export const requireGuildHasLogChannel = async (guild: Guild, logChannelId: string) => {
    const { user: botUser } = client;

    const logChannel = await guild.channels.fetch(logChannelId, { force: true });
    if (logChannel === null) {
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
  };

  export const requireManageableRole = async (guild: Guild, roleId: string) => {
    const botMember = await guild.members.fetchMe({ force: true });
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
  };
}

export default BotChecker;