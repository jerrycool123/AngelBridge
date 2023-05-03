import { GaxiosError } from 'gaxios';
import { OAuth2Client } from 'google-auth-library';
import PQueue from 'p-queue';

import Env from './env.js';

namespace GoogleUtility {
  export const apiKey = Env.GOOGLE_API_KEY;
  const apiQueue = new PQueue({ autoStart: true, intervalCap: 1, interval: 100 });

  export const addJobToQueue = (job: () => Promise<unknown>) =>
    apiQueue.add(() =>
      job().catch((err) =>
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        console.error(`An error occurred while executing a Google API job:\n${err}`),
      ),
    );

  export const createOAuth2Client = () =>
    new OAuth2Client({
      clientId: Env.GOOGLE_CLIENT_ID,
      clientSecret: Env.GOOGLE_CLIENT_SECRET,
    });

  export const getTokensFromCode = async (
    oauth2Client: OAuth2Client,
    code: string,
    redirectUrl: string,
  ): Promise<{ success: true; refreshToken: string } | { success: false; error: string }> => {
    let refreshToken: string | null | undefined = undefined;

    try {
      const result = await oauth2Client.getToken({
        code,
        redirect_uri: redirectUrl,
      });
      const {
        tokens: { refresh_token },
      } = result;
      refreshToken = refresh_token;
    } catch (err) {
      console.error(err);
    }
    if (refreshToken == null) {
      return { success: false, error: 'Failed to get refresh token' };
    }

    return { success: true, refreshToken };
  };

  export const getAccessToken = async (
    oauth2Client: OAuth2Client,
    refreshToken: string,
  ): Promise<{ success: true; accessToken: string } | { success: false; error: string }> => {
    let accessToken: string | null | undefined;
    try {
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { token } = await oauth2Client.getAccessToken();
      accessToken = token;
    } catch (err) {
      console.error(err);
      if (err instanceof GaxiosError && err.response !== undefined) {
        const data = err.response.data as unknown;
        if (typeof data === 'object' && data !== null && 'error' in data) {
          return {
            success: false,
            error: 'This account integration is expired. Please reconnect it again.',
          };
        }
      }
      return { success: false, error: 'Invalid refresh token' };
    }
    if (accessToken == null) {
      return { success: false, error: 'Failed to get access token' };
    }

    return { success: true, accessToken };
  };
}

export default GoogleUtility;
