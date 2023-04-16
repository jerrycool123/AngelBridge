import { RepliableInteraction } from 'discord.js';

export class CustomError extends Error {
  interaction: RepliableInteraction;
  followUp: boolean;

  constructor(message: string, interaction: RepliableInteraction, followUp = false) {
    super(message);
    this.name = 'CustomError';
    this.interaction = interaction;
    this.followUp = followUp;
  }
}
