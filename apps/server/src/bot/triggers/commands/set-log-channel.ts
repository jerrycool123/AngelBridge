import { SlashCommandBuilder } from 'discord.js';

import { Bot, BotCommandTrigger, GuildChatInputCommandInteraction } from '../../../types/bot.js';
import { DBUtils } from '../../../utils/db.js';
import { InternalServerError } from '../../../utils/error.js';
import { BotConstants } from '../../constants.js';
import { BotCheckers } from '../../utils/index.js';

export class SetLogChannelCommandTrigger implements BotCommandTrigger<true> {
  public readonly data = new SlashCommandBuilder()
    .setName('set-log-channel')
    .setDescription('Set a log channel where the membership verification requests would be sent.')
    .setDefaultMemberPermissions(BotConstants.ModeratorPermissions)
    .addGenericChannelOption('channel', 'The log channel in this server', true);
  public readonly guildOnly = true;
  public readonly botHasManageRolePermission = false;

  public async execute(
    bot: Bot<true>,
    interaction: GuildChatInputCommandInteraction,
  ): Promise<void> {
    const { guild, options } = interaction;

    await interaction.deferReply({ ephemeral: true });

    // Get log channel
    const channel = options.getChannel('channel', true);
    const logChannel = await BotCheckers.requireGuildHasLogChannel(bot, guild, channel.id);

    // Check if the bot can send messages in the log channel
    try {
      await logChannel.send({
        content: 'I will send membership verification requests to this channel.',
      });
    } catch (error) {
      console.error(error);
      throw new InternalServerError(`Failed to send messages in <#${logChannel.id}>.`);
    }

    // Add the log channel to DB
    const guildConfig = await DBUtils.upsertGuild({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL(),
      logChannel: channel.id,
    });

    if (guildConfig.logChannel === null) {
      throw new InternalServerError('Failed to set the log channel.');
    }

    await interaction.genericReply({
      content: `The log channel has been set to <#${guildConfig.logChannel}>.`,
    });
  }
}
