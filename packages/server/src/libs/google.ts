import { GaxiosError } from 'gaxios';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import PQueue from 'p-queue';

import Env from './env.js';

namespace GoogleAPI {
  export const apiKey = Env.GOOGLE_API_KEY;
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

  export const revokeRefreshToken = async (
    oauth2Client: OAuth2Client,
    refreshToken: string,
  ): Promise<{ success: true } | { success: false; error: string }> => {
    try {
      await oauth2Client.revokeToken(refreshToken);
    } catch (err) {
      console.error(err);
      return { success: false, error: 'Failed to revoke refresh token' };
    }

    return { success: true };
  };

  // Ref1: https://github.com/member-gentei/member-gentei/blob/main/gentei/membership/membership.go'
  // Ref2: https://github.com/konnokai/Discord-Stream-Notify-Bot/blob/master/Discord%20Stream%20Notify%20Bot/SharedService/YoutubeMember/CheckMemberShip.cs
  export const verifyYouTubeMembership = async (refreshToken: string, videoId: string) => {
    const oauth2Client = GoogleAPI.createOAuth2Client();

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });
    const youTubeApi = google.youtube({ version: 'v3', auth: oauth2Client });
    try {
      await youTubeApi.commentThreads.list({
        part: ['id'],
        videoId,
        maxResults: 1,
      });
      return true;
    } catch (error) {
      // ! TODO: distinguish different videos
      // We assume that user does not have the YouTube channel membership if the API call fails
      console.error(error);
    }
    return false;
  };
}

export default GoogleAPI;
