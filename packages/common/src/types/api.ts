import { CustomHttpRequest } from './express';
import { MembershipResource, UserResource, YouTubeChannelResource } from './resource';
import { GuildResource, MembershipRoleResource } from './resource';

/**
 * Route: `POST /server/auth/discord`
 */
export interface DiscordAuthRequest extends CustomHttpRequest<'body' | 'res'> {
  body: {
    token: string;
  };
  res: {
    id: string;
  };
}

/**
 * Route: `POST /server/auth/google`
 */
export interface GoogleAuthRequest extends CustomHttpRequest<'body' | 'res'> {
  body: {
    code: string;
  };
  res: {
    id: string;
    title: string;
    customUrl: string;
    thumbnail: string;
  };
}

/**
 * Route: `GET /server/users/@me`
 */
export interface ReadCurrentUserRequest extends CustomHttpRequest<'res'> {
  res: UserResource;
}

/**
 * Route: `DELETE /server/users/@me`
 */
export type DeleteCurrentUserRequest = CustomHttpRequest;

/**
 * Route: `POST /server/users/@me/revoke`
 */
export interface RevokeCurrentUserYouTubeRefreshTokenRequest extends CustomHttpRequest<'res'> {
  res: {
    message: 'success';
  };
}

/**
 * Route: `GET /server/guilds`
 */
export interface ReadGuildRequest extends CustomHttpRequest<'res'> {
  res: (GuildResource & {
    membershipRoles: (Omit<MembershipRoleResource, 'youTubeChannel'> & {
      youTubeChannel: YouTubeChannelResource;
      membership: MembershipResource | null;
    })[];
  })[];
}

/**
 * Route: `POSt /server/memberships/verify `
 */
export interface VerifyMembershipRequest extends CustomHttpRequest<'params' | 'res'> {
  params: {
    membershipRoleId: string;
  };
  res: MembershipResource;
}
