import express from 'express';

import AuthController from './controllers/auth.js';
import GuildController from './controllers/guild.js';
import MembershipController from './controllers/membership.js';
import UserController from './controllers/user.js';
import { requireAuth } from './middlewares/auth.js';
import RequestValidator from './validator.js';

const router = express.Router();

router.get('/heartbeat', (_req, res) => res.status(204).end());

router.post('/auth/discord', RequestValidator.discordAuth, AuthController.discordAuth);

// Protected routes

router.post('/auth/google', requireAuth, RequestValidator.googleAuth, AuthController.googleAuth);
router.get('/users/@me', requireAuth, UserController.readCurrentUser);
router.delete('/users/@me', requireAuth, UserController.deleteCurrentUser);
router.post('/users/@me/revoke', requireAuth, UserController.revokeCurrentUserYouTubeRefreshToken);
router.get('/guilds', requireAuth, GuildController.readGuilds);
router.post(
  '/memberships/:membershipRoleId',
  requireAuth,
  RequestValidator.verifyMembership,
  MembershipController.verifyMembership,
);

export default router;
