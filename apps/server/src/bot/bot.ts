import { CronJob } from 'cron';
import { Client, ClientEvents, REST, Routes } from 'discord.js';

import {
  Bot,
  BotEventHandler,
  BotRoutine,
  UnionBotButtonTrigger,
  UnionBotCommandTrigger,
  UnionBotEventHandler,
} from '../types/bot.js';

export class DiscordBot implements Bot {
  private readonly rest = new REST({ version: '10' });
  private readonly cronjobs: CronJob[] = [];

  constructor(
    private readonly token: string,
    public readonly client: Client,
    public readonly commandTriggers: UnionBotCommandTrigger[],
    public readonly buttonTriggers: UnionBotButtonTrigger[],
    public readonly eventHandlers: UnionBotEventHandler[],
    public readonly routines: BotRoutine[],
  ) {
    this.rest.setToken(token);
  }

  public async start(): Promise<void> {
    this.logInfo();
    this.registerEventHandlers();
    this.registerRoutines();
    await this.login();
  }

  public async registerCommands(): Promise<void> {
    if (!this.client.isReady()) {
      throw new Error('Client is not ready.');
    }

    try {
      await this.rest.put(Routes.applicationCommands((this.client as Client<true>).user.id), {
        body: this.commandTriggers.map(({ data }) => data),
      });
      console.error('Successfully registered global application commands.');
    } catch (error) {
      console.error('Failed to registered global application commands.');
      console.error(error);
    }
  }

  private registerEventHandlers(): void {
    this.eventHandlers.forEach((handler) => this.registerEventHandler(handler));
  }

  private registerEventHandler<E extends keyof ClientEvents>(handler: BotEventHandler<E>): void {
    const client = this.client;
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

  private registerRoutines(): void {
    for (const routine of this.routines) {
      console.log(`Starting routine: ${routine.name}`);
      this.cronjobs.push(
        new CronJob({
          cronTime: routine.schedule,
          onTick: () => routine.execute(this),
          start: true,
        }),
      );
    }
  }

  private async login(): Promise<void> {
    try {
      await this.client.login(this.token);
    } catch (error) {
      console.error(error);
    }
  }

  private logInfo(): void {
    console.log('==============================');
    console.log('# Discord Bot Config\n');

    console.log('Button Triggers:');
    for (const buttonTrigger of this.buttonTriggers) {
      console.log('-', buttonTrigger.customId);
    }

    console.log('\nCommand Triggers:');
    for (const commandTrigger of this.commandTriggers) {
      console.log(
        '-',
        (commandTrigger.data.name ?? '<unknown command>') + ':',
        commandTrigger.data.description ?? '',
      );
    }

    console.log('\nRoutines:');
    for (const routine of this.routines) {
      console.log('-', routine.name, routine.schedule);
    }

    console.log('\nEvent Handlers:');
    for (const eventHandler of this.eventHandlers) {
      console.log('-', eventHandler.name);
    }
    console.log('==============================');
  }
}
