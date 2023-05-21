import { CustomRequestHandler, DiscordAuthRequest, GoogleAuthRequest } from '@angel-bridge/common';
import { UsersAPI } from '@discordjs/core';
import { REST } from '@discordjs/rest';
import { google, youtube_v3 } from 'googleapis';
import jwt from 'jsonwebtoken';

import { upsertUserCollection } from '../../bot/utils/db.js';
import { symmetricEncrypt } from '../../libs/crypto.js';
import DiscordAPI from '../../libs/discord.js';
import Env from '../../libs/env.js';
import { BadRequestError, InternalServerError } from '../../libs/error.js';
import GoogleAPI from '../../libs/google.js';
import UserCollection from '../../models/user.js';
import { getSession } from '../middlewares/auth.js';

namespace AuthController {
  export const discordAuth: CustomRequestHandler<DiscordAuthRequest> = async (req, res) => {
    const { token } = req.body;

    // Verify JWT token
    const payload = jwt.verify(token, Env.NEXTAUTH_SECRET);
    if (typeof payload !== 'object' || typeof payload.refresh_token !== 'string') {
      throw new BadRequestError('Invalid token');
    }
    const { refresh_token } = payload;

    // Refresh access token
    const result = await DiscordAPI.getAccessToken(refresh_token);
    if (!result.success) {
      throw new BadRequestError(result.error);
    }
    const { accessToken, newRefreshToken } = result;
    const discordRestApi = new REST({ version: '10', authPrefix: 'Bearer' }).setToken(accessToken);

    // Get user info
    const discordUsersApi = new UsersAPI(discordRestApi);
    const { id, username, discriminator, avatar: avatarHash } = await discordUsersApi.getCurrent();
    let avatar: string;
    if (avatarHash === null) {
      const defaultAvatarNumber = parseInt(discriminator) % 5;
      avatar = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
    } else {
      const format = avatarHash.startsWith('a_') ? 'gif' : 'png';
      avatar = `https://cdn.discordapp.com/avatars/${id}/${avatarHash}.${format}`;
    }

    // Upsert user info
    const newEncryptedRefreshToken = symmetricEncrypt(newRefreshToken);
    if (newEncryptedRefreshToken === null) {
      throw new InternalServerError('Failed to encrypt refresh token');
    }
    const userDoc = await upsertUserCollection(
      {
        id,
        username,
        discriminator,
      },
      avatar,
      newEncryptedRefreshToken,
    );

    return res.status(201).send({ id: userDoc._id });
  };

  export const googleAuth: CustomRequestHandler<GoogleAuthRequest> = async (req, res) => {
    const { code } = req.body;
    const session = getSession(req);
    const userDoc = await UserCollection.findById(session.id);
    if (userDoc === null) {
      throw new BadRequestError('User not found');
    }

    // Get refresh token from authorization code
    const oauth2Client = GoogleAPI.createOAuth2Client();
    const result = await GoogleAPI.getTokensFromCode(oauth2Client, code, 'postmessage');
    if (!result.success) {
      throw new BadRequestError(result.error);
    }
    const { refreshToken } = result;

    // Get channel info from YouTube API
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const youtubeApi = google.youtube({ version: 'v3', auth: oauth2Client });
    let channel: youtube_v3.Schema$Channel | null = null;
    try {
      const {
        data: { items },
      } = await youtubeApi.channels.list({ part: ['snippet'], mine: true });
      channel = items?.[0] ?? null;
    } catch (error) {
      console.error(error);
    }
    const [youTubeChannelId, title, customUrl, thumbnail] = [
      channel?.id,
      channel?.snippet?.title,
      channel?.snippet?.customUrl,
      channel?.snippet?.thumbnails?.default?.url,
    ];
    if (youTubeChannelId == null || title == null || customUrl == null || thumbnail == null) {
      throw new BadRequestError(`Could not retrieve your YouTube channel information`);
    }

    // Check channel in database
    if (userDoc.youTube !== null && userDoc.youTube.id !== youTubeChannelId) {
      throw new BadRequestError('You have already connected to a different YouTube channel');
    } else {
      const otherUser = await UserCollection.findOne({
        '_id': { $ne: userDoc._id },
        'youTube.id': youTubeChannelId,
      });
      if (otherUser !== null) {
        throw new BadRequestError(
          'This YouTube channel has already been connected to another Discord account',
        );
      }
    }

    // Update user YouTube channel info
    const encryptedRefreshToken = symmetricEncrypt(refreshToken);
    if (encryptedRefreshToken === null) {
      throw new InternalServerError('Could not encrypt refresh token');
    }
    userDoc.youTube = {
      id: youTubeChannelId,
      title,
      customUrl,
      thumbnail,
      refreshToken: encryptedRefreshToken,
    };
    await userDoc.save();

    return res.status(201).send({
      id: userDoc.youTube.id,
      title: userDoc.youTube.title,
      customUrl: userDoc.youTube.customUrl,
      thumbnail: userDoc.youTube.thumbnail,
    });
  };
}

export default AuthController;
