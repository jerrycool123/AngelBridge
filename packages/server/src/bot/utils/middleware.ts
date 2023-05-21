import { Guild, GuildChannel, PermissionFlagsBits, RepliableInteraction } from 'discord.js';

import { ForbiddenError, MethodNotAllowedError } from '../../libs/error.js';

export const useGuildOnly =
  <T extends RepliableInteraction>(
    execute: (
      interaction: T & {
        guild: Guild;
        channel: GuildChannel;
      },
      errorConfig: BotErrorConfig,
    ) => Promise<void>,
  ) =>
  async (interaction: T, errorConfig: BotErrorConfig) => {
    const { guild, channel } = interaction;
    if (guild === null || channel === null || !(channel instanceof GuildChannel)) {
      throw new MethodNotAllowedError('This interaction is unavailable in DM channels!');
    }
    await execute(
      interaction as T & {
        guild: Guild;
        channel: GuildChannel;
      },
      errorConfig,
    );
  };

export const useBotWithManageRolePermission =
  <T extends RepliableInteraction>(
    execute: (
      interaction: T & { guild: Guild; channel: GuildChannel },
      errorConfig: BotErrorConfig,
    ) => Promise<void>,
  ) =>
  async (interaction: T & { guild: Guild; channel: GuildChannel }, errorConfig: BotErrorConfig) => {
    const { channel, client } = interaction;
    if (!(channel.permissionsFor(client.user)?.has(PermissionFlagsBits.ManageRoles) ?? false)) {
      throw new ForbiddenError(
        'The bot does not have the `Manage Roles` permission in this server.\n' +
          'Please try again after giving the bot this permission.',
      );
    }
    await execute(interaction, errorConfig);
  };

export const useUserWithManageRolePermission =
  <T extends RepliableInteraction>(
    execute: (
      interaction: T & { guild: Guild; channel: GuildChannel },
      errorConfig: BotErrorConfig,
    ) => Promise<void>,
  ) =>
  async (interaction: T & { guild: Guild; channel: GuildChannel }, errorConfig: BotErrorConfig) => {
    const { channel, user } = interaction;
    if (!(channel.permissionsFor(user)?.has(PermissionFlagsBits.ManageRoles) ?? false)) {
      throw new ForbiddenError(
        'You do not have the `Manage Roles` permission in this server to use this interaction.',
      );
    }
    await execute(interaction, errorConfig);
  };
