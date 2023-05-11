import express from 'express';

import AuthController from './controllers/auth.js';
import GuildController from './controllers/guild.js';
import MembershipController from './controllers/membership.js';
import UserController from './controllers/user.js';
import { requireAuth } from './middlewares/auth.js';
import RequestValidator from './validator.js';

const router = express.Router();

router.post('/auth/discord', RequestValidator.discordAuth, AuthController.discordAuth);

// Protected routes
router.use(requireAuth);

router.post('/auth/google', RequestValidator.googleAuth, AuthController.googleAuth);
router.get('/users/@me', UserController.readCurrentUser);
router.post('/users/@me/revoke', UserController.revokeCurrentUserYouTubeRefreshToken);
router.get('/guilds', GuildController.readGuilds);
router.post(
  '/memberships/:membershipRoleId',
  RequestValidator.verifyMembership,
  MembershipController.verifyMembership,
);

export default router;
