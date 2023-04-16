import { Client, GatewayIntentBits, PermissionFlagsBits, REST, Routes } from 'discord.js';

import Env from '../libs/env.js';
import CustomButton from './buttons/index.js';
import CustomBotCommand from './commands/index.js';
import type { UnionCustomBotEventHandler } from './handlers/index.js';

class DiscordBotConfig {
  private static rest = new REST({ version: '10' }).setToken(Env.DISCORD_BOT_TOKEN);

  static requiredIntents = [GatewayIntentBits.Guilds];
  static moderatorPermissions = PermissionFlagsBits.ManageRoles;

  // Initialize later
  static globalCommands: CustomBotCommand[] = [];
  static guildCommands: CustomBotCommand[] = [];
  static allCommands: CustomBotCommand[] = [];
  static buttons: CustomButton[] = [];
  static handlers: UnionCustomBotEventHandler[] = [];

  static addGlobalCommands(commands: CustomBotCommand[]) {
    DiscordBotConfig.globalCommands.push(...commands);
    DiscordBotConfig.allCommands.push(...commands);
  }

  static addGuildCommands(commands: CustomBotCommand[]) {
    DiscordBotConfig.guildCommands.push(...commands);
    DiscordBotConfig.allCommands.push(...commands);
  }

  static addButtons(buttons: CustomButton[]) {
    DiscordBotConfig.buttons.push(...buttons);
  }

  static addEventHandlers(handlers: UnionCustomBotEventHandler[]) {
    DiscordBotConfig.handlers.push(...handlers);
  }

  static async registerBotGlobalCommands() {
    DiscordBotConfig.rest
      .put(Routes.applicationCommands(Env.DISCORD_BOT_CLIENT_ID), {
        body: DiscordBotConfig.globalCommands.map(({ data }) => data),
      })
      .then(() => console.log(`Successfully registered global application commands.`))
      .catch(console.error);
  }

  static async registerBotGuildCommands(guildId: string) {
    DiscordBotConfig.rest
      .put(Routes.applicationGuildCommands(Env.DISCORD_BOT_CLIENT_ID, guildId), {
        body: DiscordBotConfig.guildCommands.map(({ data }) => data),
      })
      .then(() => console.log(`Successfully registered application commands to guild ${guildId}.`))
      .catch(console.error);
  }

  static registerBotEventHandlers(client: Client<boolean>) {
    DiscordBotConfig.handlers.forEach((handler) => handler.register(client));
  }

  static show() {
    console.log('==============================');
    console.log('# Discord Bot Config\n');

    console.log('Global Commands:');
    for (const command of DiscordBotConfig.globalCommands) {
      console.log(
        '-',
        (command.data.name ?? '<unknown command>') + ':',
        command.data.description?.slice(0, 32) ?? '',
      );
    }

    console.log('\nGuild Commands:');
    for (const command of DiscordBotConfig.guildCommands) {
      console.log(
        '-',
        (command.data.name ?? '<unknown command>') + ':',
        command.data.description?.slice(0, 64) ?? '',
      );
    }

    console.log('\nEvent Handlers:');
    for (const handler of DiscordBotConfig.handlers) {
      console.log('-', handler.name);
    }
    console.log('==============================');
  }
}

export default DiscordBotConfig;
