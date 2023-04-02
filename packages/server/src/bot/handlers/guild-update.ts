import CustomBotEventHandler from '.';
import { upsertGuildConfig } from '../../libs/discord-util';

const guildUpdate = new CustomBotEventHandler<'guildUpdate'>({
  name: 'guildUpdate',
  execute: async (_oldGuild, newGuild) => {
    await upsertGuildConfig(newGuild);
  },
});

export default guildUpdate;
