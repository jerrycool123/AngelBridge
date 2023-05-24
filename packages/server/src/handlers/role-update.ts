import { updateMembershipRoleCollection } from '../utils/db.js';
import CustomBotEventHandler from './index.js';

const roleUpdate = new CustomBotEventHandler<'roleUpdate'>({
  name: 'roleUpdate',
  execute: async (_oldRole, newRole) => {
    await updateMembershipRoleCollection(newRole);
  },
});

export default roleUpdate;
