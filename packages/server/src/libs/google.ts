import { GaxiosError } from 'gaxios';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

import Env from './env.js';
import Queue from './queue.js';

namespace GoogleAPI {
  export const key = Env.GOOGLE_API_KEY;
  export const queue = new Queue('Google API', {
    autoStart: true,
    intervalCap: 1,
    interval: 100,
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
  export const verifyYouTubeMembership = async (
    refreshToken: string,
    videoId: string,
  ): Promise<
    | {
        success: true;
      }
    | {
        success: false;
        error:
          | 'token_expired_or_revoked'
          | 'forbidden'
          | 'comment_disabled'
          | 'video_not_found'
          | 'unknown_error';
      }
  > => {
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
      return {
        success: true,
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'errors' in error &&
        Array.isArray(error.errors) &&
        error.errors.length > 0
      ) {
        const errorObject = error.errors[0] as unknown;
        if (
          typeof errorObject === 'object' &&
          errorObject !== null &&
          'reason' in errorObject &&
          typeof errorObject.reason === 'string'
        ) {
          if (errorObject.reason === 'forbidden') {
            return {
              success: false,
              error: 'forbidden',
            };
          } else if (errorObject.reason === 'commentsDisabled') {
            console.error(error);
            return {
              success: false,
              error: 'comment_disabled',
            };
          } else if (errorObject.reason === 'videoNotFound') {
            console.error(error);
            return {
              success: false,
              error: 'video_not_found',
            };
          }
        }
      } else if (error instanceof GaxiosError && error.response !== undefined) {
        const data = error.response.data as unknown;
        if (
          typeof data === 'object' &&
          data !== null &&
          'error_description' in data &&
          typeof data.error_description === 'string' &&
          data.error_description.toLowerCase().includes('token has been expired or revoked')
        ) {
          return {
            success: false,
            error: 'token_expired_or_revoked',
          };
        }
      }
      console.error(error);
    }
    return {
      success: false,
      error: 'unknown_error',
    };
  };
}

export default GoogleAPI;
