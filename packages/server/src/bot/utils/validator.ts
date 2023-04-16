import {
  ButtonInteraction,
  CacheType,
  ChatInputCommandInteraction,
  Guild,
  GuildChannel,
  PermissionFlagsBits,
} from 'discord.js';

export const useGuildOnly =
  <T extends ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>>(
    execute: (
      interaction: T & {
        guild: Guild;
        channel: GuildChannel;
      },
    ) => Promise<void>,
  ) =>
  async (interaction: T) => {
    const { guild, channel } = interaction;
    if (!guild || !channel || !(channel instanceof GuildChannel)) {
      await interaction.reply({
        content: 'This interaction is unavailable in DM channels!',
        ephemeral: true,
      });
      return;
    }
    await execute(
      interaction as T & {
        guild: Guild;
        channel: GuildChannel;
      },
    );
  };

export const useBotWithManageRolePermission =
  <T extends ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>>(
    execute: (interaction: T & { guild: Guild; channel: GuildChannel }) => Promise<void>,
  ) =>
  async (interaction: T & { guild: Guild; channel: GuildChannel }) => {
    const { channel, client } = interaction;
    if (!channel.permissionsFor(client.user)?.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({
        content:
          'The bot does not have the `Manage Roles` permission in this server.\n' +
          'Please try again after giving the bot this permission.',
        ephemeral: true,
      });
      return;
    }
    await execute(interaction);
  };

export const useUserWithManageRolePermission =
  <T extends ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>>(
    execute: (interaction: T & { guild: Guild; channel: GuildChannel }) => Promise<void>,
  ) =>
  async (interaction: T & { guild: Guild; channel: GuildChannel }) => {
    const { channel, user } = interaction;
    if (!channel.permissionsFor(user)?.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({
        content:
          'You do not have the `Manage Roles` permission in this server to use this interaction.',
        ephemeral: true,
      });
      return;
    }
    await execute(interaction);
  };
