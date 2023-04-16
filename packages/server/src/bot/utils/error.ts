import { RepliableInteraction } from 'discord.js';

export class CustomError extends Error {
  interaction: RepliableInteraction | null;
  followUp: boolean;

  constructor(message: string, interaction: RepliableInteraction | null, followUp = false) {
    super(message);
    this.name = 'CustomError';
    this.interaction = interaction;
    this.followUp = followUp;
  }
}
