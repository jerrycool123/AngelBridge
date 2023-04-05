import {
  ApplicationCommandOptionBase,
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

export const generateRandomColorNumber = () => Math.floor(Math.random() * 16777215);

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
