import { Guild, GuildChannel, PermissionFlagsBits, RepliableInteraction } from 'discord.js';

import { CustomBotError } from './bot-error.js';

export const useFollowUpCustomError =
  <T extends RepliableInteraction>(execute: (interaction: T) => Promise<void>) =>
  async (interaction: T) => {
    try {
      await execute(interaction);
    } catch (error) {
      if (error instanceof CustomBotError) {
        error.followUp = true;
      }
      throw error;
    }
  };

export const useGuildOnly =
  <T extends RepliableInteraction>(
    execute: (
      interaction: T & {
        guild: Guild;
        channel: GuildChannel;
      },
    ) => Promise<void>,
  ) =>
  async (interaction: T) => {
    const { guild, channel } = interaction;
    if (guild === null || channel === null || !(channel instanceof GuildChannel)) {
      throw new CustomBotError('This interaction is unavailable in DM channels!', interaction);
    }
    await execute(
      interaction as T & {
        guild: Guild;
        channel: GuildChannel;
      },
    );
  };

export const useBotWithManageRolePermission =
  <T extends RepliableInteraction>(
    execute: (interaction: T & { guild: Guild; channel: GuildChannel }) => Promise<void>,
  ) =>
  async (interaction: T & { guild: Guild; channel: GuildChannel }) => {
    const { channel, client } = interaction;
    if (!(channel.permissionsFor(client.user)?.has(PermissionFlagsBits.ManageRoles) ?? false)) {
      throw new CustomBotError(
        'The bot does not have the `Manage Roles` permission in this server.\n' +
          'Please try again after giving the bot this permission.',
        interaction,
      );
    }
    await execute(interaction);
  };

export const useUserWithManageRolePermission =
  <T extends RepliableInteraction>(
    execute: (interaction: T & { guild: Guild; channel: GuildChannel }) => Promise<void>,
  ) =>
  async (interaction: T & { guild: Guild; channel: GuildChannel }) => {
    const { channel, user } = interaction;
    if (!(channel.permissionsFor(user)?.has(PermissionFlagsBits.ManageRoles) ?? false)) {
      throw new CustomBotError(
        'You do not have the `Manage Roles` permission in this server to use this interaction.',
        interaction,
      );
    }
    await execute(interaction);
  };
