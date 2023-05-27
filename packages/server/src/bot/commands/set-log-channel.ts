import { SlashCommandBuilder } from 'discord.js';

import { BotChecker } from '../../checkers/bot.js';
import { InternalServerError } from '../../libs/error.js';
import { BotCommand, GuildChatInputCommandInteraction } from '../../types/bot.js';
import { BotConstants } from '../constants.js';
import { genericOption } from '../utils/common.js';
import { upsertGuildCollection } from '../utils/db.js';

export class SetLogChannelCommand implements BotCommand<true> {
  public readonly data = new SlashCommandBuilder()
    .setName('set-log-channel')
    .setDescription('Set a log channel where the membership verification requests would be sent.')
    .setDefaultMemberPermissions(BotConstants.ModeratorPermissions)
    .addChannelOption(genericOption('channel', 'The log channel in this server', true));
  public readonly guildOnly = true;
  public readonly botHasManageRolePermission = false;

  public async execute(interaction: GuildChatInputCommandInteraction): Promise<void> {
    const { guild, options } = interaction;

    await interaction.deferReply({ ephemeral: true });

    // Get log channel
    const channel = options.getChannel('channel', true);
    const logChannel = await BotChecker.requireGuildHasLogChannel(guild, channel.id);

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
    const guildConfig = await upsertGuildCollection(guild);
    guildConfig.logChannel = channel.id;
    await guildConfig.save();

    await interaction.editReply({
      content: `The log channel has been set to <#${channel.id}>.`,
    });
  }
}
