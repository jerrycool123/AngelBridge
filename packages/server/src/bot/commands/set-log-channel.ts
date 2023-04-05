import { PermissionFlagsBits, SlashCommandBuilder, TextChannel } from 'discord.js';

import { genericOption, replyGuildOnly, upsertGuildConfig } from '../../libs/discord-util.js';
import DiscordBotConfig from '../config.js';
import CustomBotCommand from './index.js';

const set_log_channel = new CustomBotCommand({
  data: new SlashCommandBuilder()
    .setName('set-log-channel')
    .setDescription('Set a log channel where the membership verification requests would be sent.')
    .setDefaultMemberPermissions(DiscordBotConfig.adminPermissions)
    .addChannelOption(genericOption('channel', 'The log channel in this guild', true)),
  async execute(interaction) {
    const { guild, options } = interaction;
    if (!guild) {
      await replyGuildOnly(interaction);
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const channel = options.getChannel('channel', true);

    let sendMessageSuccess = true;
    if (!(channel instanceof TextChannel)) {
      await interaction.editReply({
        content: 'The log channel must be a text channel.',
      });
      return;
    } else if (!guild.members.me?.permissionsIn(channel).has(PermissionFlagsBits.ViewChannel)) {
      await interaction.editReply({
        content: `The bot does not have the permission to view #${channel.name}(ID: ${channel.id}).`,
      });
      return;
    } else if (!guild.members.me?.permissionsIn(channel).has(PermissionFlagsBits.SendMessages)) {
      sendMessageSuccess = false;
    } else {
      try {
        await channel.send({
          content: 'I will send membership verification requests to this channel.',
        });
      } catch (error) {
        console.error(error);
        sendMessageSuccess = false;
      }
    }

    if (!sendMessageSuccess) {
      await interaction.editReply({
        content: `The bot does not have the permission to send messages in #${channel.name}(ID: ${channel.id}).`,
      });
      return;
    }

    const guildConfig = await upsertGuildConfig(guild);
    guildConfig.logChannel = channel.id;
    await guildConfig.save();

    await interaction.editReply({
      content: `The log channel has been set to <#${channel.id}>.`,
    });
  },
});

export default set_log_channel;
