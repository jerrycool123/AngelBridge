import { CommandInteraction, PermissionFlagsBits, TextChannel } from 'discord.js';
import type { ApplicationCommandOptionBase } from 'discord.js';
import { Guild as DiscordGuild } from 'discord.js';

import client from '../bot';
import Guild from '../models/guild';
import ocrWorker from './ocr';

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

export const ocrAndPushToLogChannel =
  (guildId: string, languageCode: SupportedOCRLanguage['code'], url: string) => async () => {
    const dbGuild = await Guild.findById(guildId);
    if (!dbGuild) {
      throw new Error(`Guild ID ${dbGuild} does not exist in the database`);
    } else if (!dbGuild.logChannel) {
      throw new Error(`Guild ${dbGuild.name}(ID:${dbGuild._id}) does not have a log channel`);
    }

    const guild = await client.guilds.fetch(guildId);

    const logChannel = await guild.channels.fetch(dbGuild.logChannel, { force: true });
    if (!logChannel) {
      throw new Error(
        `The log channel ID ${dbGuild.logChannel} in guild ${guild.name}(ID: ${guild.id}) does not exist.`,
      );
    } else if (!(logChannel instanceof TextChannel)) {
      throw new Error(`The log channel ${logChannel.name} must be a text channel.`);
    } else if (!guild.members.me?.permissionsIn(logChannel).has(PermissionFlagsBits.ViewChannel)) {
      throw new Error(
        `The bot does not have the permission to view #${logChannel.name}(ID: ${logChannel.id}).`,
      );
    } else if (!guild.members.me?.permissionsIn(logChannel).has(PermissionFlagsBits.SendMessages)) {
      throw new Error(
        `The bot does not have the permission to send messages in #${logChannel.name}(ID: ${logChannel.id}).`,
      );
    }

    const text = await ocrWorker.recognize(languageCode, url);
    if (!text) {
      throw new Error('The OCR worker failed to recognize the text.');
    }

    await logChannel.send({
      content: text,
    });
  };
