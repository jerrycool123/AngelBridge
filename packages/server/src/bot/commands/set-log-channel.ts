import { SlashCommandBuilder } from 'discord.js';

import DiscordBotConfig from '../config.js';
import { requireGuildHasLogChannel } from '../utils/checker.js';
import { genericOption } from '../utils/common.js';
import { upsertGuildCollection } from '../utils/db.js';
import { CustomError } from '../utils/error.js';
import { useGuildOnly } from '../utils/validator.js';
import CustomBotCommand from './index.js';

const set_log_channel = new CustomBotCommand({
  data: new SlashCommandBuilder()
    .setName('set-log-channel')
    .setDescription('Set a log channel where the membership verification requests would be sent.')
    .setDefaultMemberPermissions(DiscordBotConfig.moderatorPermissions)
    .addChannelOption(genericOption('channel', 'The log channel in this server', true)),
  execute: useGuildOnly(async (interaction) => {
    const { guild, options } = interaction;

    await interaction.deferReply({ ephemeral: true });

    // Get log channel
    const channel = options.getChannel('channel', true);
    const logChannel = await requireGuildHasLogChannel(interaction, guild, channel.id);

    // Check if the bot can send messages in the log channel
    try {
      await logChannel.send({
        content: 'I will send membership verification requests to this channel.',
      });
    } catch (error) {
      console.error(error);
      throw new CustomError(`Failed to send messages in <#${logChannel.id}>.`, interaction);
    }

    // Add the log channel to DB
    const guildConfig = await upsertGuildCollection(guild);
    guildConfig.logChannel = channel.id;
    await guildConfig.save();

    await interaction.editReply({
      content: `The log channel has been set to <#${channel.id}>.`,
    });
  }),
});

export default set_log_channel;
