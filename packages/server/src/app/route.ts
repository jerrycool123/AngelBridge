import express from 'express';

import AuthController from './controllers/auth.js';
import GuildController from './controllers/guild.js';
import MembershipController from './controllers/membership.js';
import UserController from './controllers/user.js';
import { requireAuth } from './middlewares/auth.js';
import Validator from './validator.js';

const router = express.Router();

router.post('/auth/discord', Validator.discordAuth, AuthController.discordAuth);

// Protected routes
router.use(requireAuth);

router.post('/auth/google', Validator.googleAuth, AuthController.googleAuth);
router.get('/users/@me', UserController.readCurrentUser);
router.get('/guilds', GuildController.readGuilds);
router.post(
  '/memberships/:membershipRoleId',
  Validator.verifyMembership,
  MembershipController.verifyMembership,
);

export default router;
