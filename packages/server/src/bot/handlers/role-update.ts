import { updateRoleConfig } from '../../libs/discord-util.js';
import CustomBotEventHandler from './index.js';

const roleUpdate = new CustomBotEventHandler<'roleUpdate'>({
  name: 'roleUpdate',
  execute: async (_oldRole, newRole) => {
    await updateRoleConfig(newRole);
  },
});

export default roleUpdate;
