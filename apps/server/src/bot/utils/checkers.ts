import {
  Guild,
  GuildChannel,
  GuildMember,
  PermissionFlagsBits,
  Role,
  TextChannel,
  User,
} from 'discord.js';

import { Bot } from '../../types/bot.js';
import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
} from '../../utils/error.js';

export class BotCheckers {
  public static isUserHasManageRolePermissionInChannel(user: User, channel: GuildChannel): boolean {
    return channel.permissionsFor(user)?.has(PermissionFlagsBits.ManageRoles) ?? false;
  }

  public static async fetchUser(
    bot: Bot<true>,
    userId: string,
    force = true,
  ): Promise<User | null> {
    try {
      return await bot.client.users.fetch(userId, { force });
    } catch (error) {
      console.error(error);
    }
    return null;
  }

  public static async fetchGuild(
    bot: Bot<true>,
    guildId: string,
    force = true,
  ): Promise<Guild | null> {
    try {
      return await bot.client.guilds.fetch({ guild: guildId, force });
    } catch (error) {
      console.error(error);
    }
    return null;
  }

  public static async fetchGuildOwner(guild: Guild, force = true): Promise<GuildMember | null> {
    try {
      return await guild.fetchOwner({ force });
    } catch (error) {
      console.error(error);
    }
    return null;
  }

  public static async fetchGuildMember(
    guild: Guild,
    userId: string,
    force = true,
  ): Promise<GuildMember | null> {
    try {
      return await guild.members.fetch({ user: userId, force });
    } catch (error) {
      console.error(error);
    }
    return null;
  }

  public static async fetchRole(guild: Guild, roleId: string, force = true): Promise<Role | null> {
    try {
      return await guild.roles.fetch(roleId, { force });
    } catch (error) {
      console.error(error);
    }
    return null;
  }

  public static async fetchChannel(guild: Guild, channelId: string, force = true) {
    try {
      return await guild.channels.fetch(channelId, { force });
    } catch (error) {
      console.error(error);
    }
    return null;
  }

  public static async requireGuildHasLogChannel(
    bot: Bot<true>,
    guild: Guild,
    logChannelId: string,
    force = true,
  ): Promise<TextChannel> {
    const { user: botUser } = bot.client;

    const logChannel = await this.fetchChannel(guild, logChannelId, force);
    if (botUser === null) {
      throw new InternalServerError(`The bot is not ready.`);
    } else if (logChannel === null) {
      throw new NotFoundError(
        `The log channel <#${logChannelId}> does not exist, or I do not have permissions to view this channel.`,
      );
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

  public static async requireManageableRole(
    guild: Guild,
    roleId: string,
    force = true,
  ): Promise<void> {
    let botMember: GuildMember | null;
    try {
      botMember = await guild.members.fetchMe({ force });
    } catch (error) {
      console.error(error);
      throw new ForbiddenError('The bot is not in the server.');
    }

    if (roleId === guild.id) {
      // @everyone
      throw new BadRequestError(
        'The bot cannot manipulate @everyone role.\n' + 'Please try again with another valid role.',
      );
    } else if (botMember.roles.highest.comparePositionTo(roleId) <= 0) {
      throw new ForbiddenError(
        `Due to the role hierarchy, the bot cannot manage the role <@&${roleId}>.\n` +
          `The bot can only manage a role whose order is lower than that of its highest role <@&${botMember.roles.highest.id}>.`,
      );
    }
  }
}
