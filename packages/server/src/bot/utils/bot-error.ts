import { RepliableInteraction } from 'discord.js';

export class CustomBotError extends Error {
  interaction: RepliableInteraction | null;
  followUp: boolean;

  constructor(message: string, interaction: RepliableInteraction | null, followUp = false) {
    super(message);
    this.name = 'CustomBotError';
    this.interaction = interaction;
    this.followUp = followUp;
  }
}
