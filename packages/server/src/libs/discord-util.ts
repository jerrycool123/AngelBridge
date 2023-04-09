import {
  ActionRowBuilder,
  ApplicationCommandOptionBase,
  ButtonBuilder,
  ButtonStyle,
  CommandInteraction,
  Guild,
  Role,
} from 'discord.js';

import GuildCollection from '../models/guild.js';
import MembershipRoleCollection from '../models/membership-role.js';

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

export const upsertGuildConfig = async (guild: Guild) => {
  return await GuildCollection.findByIdAndUpdate(
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

export const updateRoleConfig = async (role: Role) => {
  return await MembershipRoleCollection.findByIdAndUpdate(
    role.id,
    {
      $set: {
        name: role.name,
        color: role.color,
      },
    },
    {
      new: true,
    },
  );
};

export const createDisabledInvalidActionRow = (label = 'Invalid request') =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('global-disabled-invalid-button')
      .setStyle(ButtonStyle.Secondary)
      .setLabel(label)
      .setDisabled(true),
  );

export const createDisabledAcceptedActionRow = (label = 'Accepted') =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('global-disabled-accepted-button')
      .setStyle(ButtonStyle.Success)
      .setLabel(label)
      .setDisabled(true),
  );

export const createDisabledRejectedActionRow = (label = 'Rejected') =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('global-disabled-rejected-button')
      .setStyle(ButtonStyle.Danger)
      .setLabel(label)
      .setDisabled(true),
  );
