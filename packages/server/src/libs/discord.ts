import { OAuth2API } from '@discordjs/core';
import { REST } from '@discordjs/rest';
import PQueue from 'p-queue';

import Env from './env.js';

namespace DiscordAPI {
  const apiQueue = new PQueue({ autoStart: true, intervalCap: 1, interval: 100 });

  export const addJob = (job: () => Promise<unknown>) =>
    apiQueue.add(async () => {
      try {
        await job();
      } catch (error) {
        console.error('An error occurred while executing a Google API job:');
        console.error(error);
      }
    });

  export const getAccessToken = async (
    refreshToken: string,
  ): Promise<
    | { success: true; accessToken: string; newRefreshToken: string }
    | { success: false; error: string }
  > => {
    let accessToken: string | null = null,
      newRefreshToken: string | null = null;
    try {
      const discordRestApi = new REST({ version: '10', authPrefix: 'Bearer' }).setToken('dummy');
      const discordOAuth2Api = new OAuth2API(discordRestApi);
      const { access_token, refresh_token } = await discordOAuth2Api.refreshToken({
        client_id: Env.DISCORD_CLIENT_ID,
        client_secret: Env.DISCORD_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });
      accessToken = access_token;
      newRefreshToken = refresh_token;
    } catch (err) {
      console.error(err);
    }
    if (accessToken === null || newRefreshToken === null) {
      return { success: false, error: 'Failed to get access token' };
    }

    return { success: true, accessToken, newRefreshToken };
  };
}

export default DiscordAPI;
