import { Client, ClientEvents, REST } from 'discord.js';
import { Routes } from 'discord.js';

import {
  Bot,
  BotEventHandler,
  UnionBotButton,
  UnionBotCommand,
  UnionBotEventHandler,
  UnionClient,
} from '../types/bot.js';

export class DiscordBot implements Bot {
  private readonly rest = new REST({ version: '10' });

  constructor(
    private readonly token: string,
    public readonly client: UnionClient,
    public readonly commands: UnionBotCommand[],
    public readonly buttons: UnionBotButton[],
    public readonly eventHandlers: UnionBotEventHandler[],
  ) {
    this.rest.setToken(token);
    this.logInfo();
  }

  public async start(): Promise<void> {
    this.registerEventHandlers();
    await this.login();
  }

  public async registerCommands() {
    if (!this.client.isReady()) {
      throw new Error('Client is not ready.');
    }

    try {
      await this.rest.put(Routes.applicationCommands(this.client.user.id), {
        body: this.commands.map(({ data }) => data),
      });
      console.error('Successfully registered global application commands.');
    } catch (error) {
      console.error('Failed to registered global application commands.');
      console.error(error);
    }
  }

  private registerEventHandlers() {
    this.eventHandlers.forEach((handler) => this.registerEventHandler(handler));
  }

  private registerEventHandler<E extends keyof ClientEvents>(handler: BotEventHandler<E>) {
    const client = this.client as Client;
    if (handler.once === true) {
      client.once(handler.name, async (...args) => {
        if (handler.name !== 'ready' && this.client.isReady() === false) return;
        await handler.execute(this, ...args);
      });
    } else {
      client.on(handler.name, async (...args) => {
        if (handler.name !== 'ready' && this.client.isReady() === false) return;
        await handler.execute(this, ...args);
      });
    }
  }

  private async login(): Promise<void> {
    try {
      await this.client.login(this.token);
    } catch (error) {
      console.error(error);
    }
  }

  private logInfo() {
    console.log('==============================');
    console.log('# Discord Bot Config\n');

    console.log('Buttons:');
    for (const button of this.buttons) {
      console.log('-', button.customId);
    }

    console.log('\nCommands:');
    for (const command of this.commands) {
      console.log(
        '-',
        (command.data.name ?? '<unknown command>') + ':',
        command.data.description ?? '',
      );
    }

    console.log('\nEvent Handlers:');
    for (const handler of this.eventHandlers) {
      console.log('-', handler.name);
    }
    console.log('==============================');
  }
}
