import type { ButtonBuilder, ButtonInteraction, CacheType } from 'discord.js';

class CustomButton {
  readonly customId: string;
  readonly data: ButtonBuilder;
  readonly execute: (interaction: ButtonInteraction<CacheType>) => Promise<void>;

  constructor({
    customId,
    data,
    execute,
  }: {
    customId: string;
    data: ButtonBuilder;
    execute: (interaction: ButtonInteraction<CacheType>) => Promise<void>;
  }) {
    this.customId = customId;
    this.data = data.setCustomId(customId);
    this.execute = execute;
  }
}

export default CustomButton;
