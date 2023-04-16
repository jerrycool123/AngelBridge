export class CustomError extends Error {
  interaction: RepliableInteraction;

  constructor(message: string, interaction: RepliableInteraction) {
    super(message);
    this.name = 'CustomError';
    this.interaction = interaction;
  }
}
