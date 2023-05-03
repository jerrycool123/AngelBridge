import type { Client, ClientEvents } from 'discord.js';

class CustomBotEventHandler<E extends keyof ClientEvents> {
  readonly name: E;
  readonly once: boolean = false;
  readonly execute: (...args: ClientEvents[E]) => Promise<void> | void;

  constructor({
    name,
    once,
    execute,
  }: {
    name: E;
    once?: boolean;
    execute: (...args: ClientEvents[E]) => Promise<void> | void;
  }) {
    this.name = name;
    if (once === true) this.once = once;
    this.execute = execute;
  }

  register(client: Client<boolean>) {
    if (this.once) {
      client.once(this.name, (...args: ClientEvents[E]) => this.execute(...args));
    } else {
      client.on(this.name, (...args: ClientEvents[E]) => this.execute(...args));
    }
  }
}

type Union<T> = T[keyof T];
export type UnionCustomBotEventHandler = Union<{
  [K in keyof ClientEvents]: CustomBotEventHandler<K>;
}>;

export default CustomBotEventHandler;
