import {
  ActionRowBuilder,
  ApplicationCommandOptionBase,
  ButtonBuilder,
  ButtonStyle,
  CommandInteraction,
  Guild as DiscordGuild,
} from 'discord.js';

import Guild from '../models/guild.js';

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

export const createInvalidActionRow = (label = 'Invalid request') =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('invalid')
      .setStyle(ButtonStyle.Secondary)
      .setLabel(label)
      .setDisabled(true),
  );

export const createAcceptedActionRow = (label = 'Accepted') =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('accepted')
      .setStyle(ButtonStyle.Success)
      .setLabel(label)
      .setDisabled(true),
  );

export const createRejectedActionRow = (label = 'Rejected') =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('rejected')
      .setStyle(ButtonStyle.Danger)
      .setLabel(label)
      .setDisabled(true),
  );
