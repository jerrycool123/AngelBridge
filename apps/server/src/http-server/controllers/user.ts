import {
  CustomRequestHandler,
  DeleteCurrentUserRequest,
  ReadCurrentUserRequest,
  RevokeCurrentUserYouTubeRefreshTokenRequest,
} from '@angel-bridge/common';

import { bot } from '../../bot/index.js';
import GuildCollection, { GuildDoc } from '../../models/guild.js';
import { MembershipRoleDoc } from '../../models/membership-role.js';
import MembershipCollection, {
  MembershipDoc,
  OAuthMembershipDoc,
} from '../../models/membership.js';
import UserCollection from '../../models/user.js';
import { MembershipService } from '../../services/membership/service.js';
import { CryptoUtils } from '../../utils/crypto.js';
import DiscordAPI from '../../utils/discord.js';
import { BadRequestError } from '../../utils/error.js';
import GoogleAPI from '../../utils/google.js';
import { getSession } from '../middlewares/auth.js';

namespace UserController {
  export const readCurrentUser: CustomRequestHandler<ReadCurrentUserRequest> = async (req, res) => {
    const session = getSession(req);

    const user = await UserCollection.findById(session.id).orFail(
      new BadRequestError('User not found'),
    );
    return res.status(200).send({
      id: user._id,
      username: user.username,
      avatar: user.avatar,
      youTube:
        user.youTube !== null
          ? {
              id: user.youTube.id,
              title: user.youTube.title,
              customUrl: user.youTube.customUrl,
              thumbnail: user.youTube.thumbnail,
            }
          : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });
  };

  export const deleteCurrentUser: CustomRequestHandler<DeleteCurrentUserRequest> = async (
    req,
    res,
  ) => {
    const session = getSession(req);

    const user = await UserCollection.findById(session.id).orFail(
      new BadRequestError('User not found'),
    );
    if (user.youTube !== null) {
      const refreshToken = CryptoUtils.decrypt(user.youTube.refreshToken);
      if (refreshToken !== null) {
        // Revoke YouTube refresh token
        const oauth2Client = GoogleAPI.createOAuth2Client();
        // ? We don't do error handling here and proceed to remove the membership
        await GoogleAPI.revokeRefreshToken(oauth2Client, refreshToken);
        user.youTube = null;
        await user.save();
      }
    }

    // Get user's memberships in DB
    const allOauthMembershipDocs = await MembershipCollection.find<MembershipDoc>({
      user: user._id,
    }).populate<{
      membershipRole: MembershipRoleDoc | null;
    }>('membershipRole');

    // Split valid and invalid memberships
    const membershipDocs: (Omit<MembershipDoc, 'membershipRole'> & {
      membershipRole: MembershipRoleDoc;
    })[] = [];
    const invalidMembershipDocs: (Omit<MembershipDoc, 'membershipRole'> & {
      membershipRole: null;
    })[] = [];
    for (const membershipDoc of allOauthMembershipDocs) {
      if (membershipDoc.membershipRole !== null) {
        membershipDocs.push(
          membershipDoc as Omit<MembershipDoc, 'membershipRole'> & {
            membershipRole: MembershipRoleDoc;
          },
        );
      } else {
        invalidMembershipDocs.push(
          membershipDoc as Omit<MembershipDoc, 'membershipRole'> & {
            membershipRole: null;
          },
        );
      }
    }

    // Remove invalid memberships
    await MembershipCollection.deleteMany({
      _id: {
        $in: invalidMembershipDocs.map((membershipDoc) => membershipDoc._id),
      },
    });

    // Group membership docs by guild
    const membershipDocRecord = membershipDocs.reduce<
      Record<
        string,
        (Omit<MembershipDoc, 'membershipRole'> & {
          membershipRole: MembershipRoleDoc;
        })[]
      >
    >((prev, membershipDoc) => {
      const guildId = membershipDoc.membershipRole.guild;
      return { ...prev, [guildId]: [...(guildId in prev ? prev[guildId] : []), membershipDoc] };
    }, {});

    // Get corresponding guilds from DB
    const guildDocs = await GuildCollection.find({
      _id: { $in: Object.keys(membershipDocRecord) },
    });
    const guildDocRecord = guildDocs.reduce<Record<string, GuildDoc>>(
      (prev, guildDoc) => ({
        ...prev,
        [guildDoc._id]: guildDoc,
      }),
      {},
    );

    const promises: Promise<unknown>[] = [];
    for (const [guildId, membershipDocGroup] of Object.entries(membershipDocRecord)) {
      if (membershipDocGroup.length === 0) continue;

      // Initialize membership service
      const guildDoc = guildId in guildDocRecord ? guildDocRecord[guildId] : null;
      const membershipService = new MembershipService(bot);
      await membershipService.initEventLog(guildId, null, guildDoc?.logChannel ?? null);

      // Remove membership
      promises.push(
        ...membershipDocGroup.map((membershipDoc) =>
          DiscordAPI.queue.add(async () =>
            membershipService.removeMembership({
              membershipDoc,
              membershipRoleData: membershipDoc.membershipRole,
              removeReason: `you have deleted your account from Angel Bridge.`,
            }),
          ),
        ),
      );
    }

    await Promise.all(promises);
    await UserCollection.findByIdAndDelete(user._id);

    return res.status(204).end();
  };

  export const revokeCurrentUserYouTubeRefreshToken: CustomRequestHandler<
    RevokeCurrentUserYouTubeRefreshTokenRequest
  > = async (req, res) => {
    const session = getSession(req);

    const user = await UserCollection.findById(session.id).orFail(
      new BadRequestError('User not found'),
    );
    if (user.youTube === null) {
      throw new BadRequestError('You have not connected your YouTube account');
    }
    const refreshToken = CryptoUtils.decrypt(user.youTube.refreshToken);
    if (refreshToken === null) {
      throw new BadRequestError('Failed to decrypt YouTube refresh token');
    }

    // Revoke YouTube refresh token
    const oauth2Client = GoogleAPI.createOAuth2Client();
    // ? We don't do error handling here and proceed to remove the membership
    await GoogleAPI.revokeRefreshToken(oauth2Client, refreshToken);
    user.youTube = null;
    await user.save();

    // Get user's OAuth memberships in DB
    const allOauthMembershipDocs = await MembershipCollection.find<OAuthMembershipDoc>({
      user: user._id,
      type: 'oauth',
    }).populate<{
      membershipRole: MembershipRoleDoc | null;
    }>('membershipRole');

    // Split valid and invalid memberships
    const oauthMembershipDocs: (Omit<OAuthMembershipDoc, 'membershipRole'> & {
      membershipRole: MembershipRoleDoc;
    })[] = [];
    const invalidOauthMembershipDocs: (Omit<OAuthMembershipDoc, 'membershipRole'> & {
      membershipRole: null;
    })[] = [];
    for (const oauthMembershipDoc of allOauthMembershipDocs) {
      if (oauthMembershipDoc.membershipRole !== null) {
        oauthMembershipDocs.push(
          oauthMembershipDoc as Omit<OAuthMembershipDoc, 'membershipRole'> & {
            membershipRole: MembershipRoleDoc;
          },
        );
      } else {
        invalidOauthMembershipDocs.push(
          oauthMembershipDoc as Omit<OAuthMembershipDoc, 'membershipRole'> & {
            membershipRole: null;
          },
        );
      }
    }

    // Remove invalid memberships
    await MembershipCollection.deleteMany({
      _id: { $in: invalidOauthMembershipDocs.map((doc) => doc._id) },
    });

    // Group membership docs by guild
    const membershipDocRecord = oauthMembershipDocs.reduce<
      Record<
        string,
        (Omit<OAuthMembershipDoc, 'membershipRole'> & {
          membershipRole: MembershipRoleDoc;
        })[]
      >
    >((prev, membershipDoc) => {
      const guildId = membershipDoc.membershipRole.guild;
      return { ...prev, [guildId]: [...(guildId in prev ? prev[guildId] : []), membershipDoc] };
    }, {});

    // Get corresponding guilds from DB
    const guildDocs = await GuildCollection.find({
      _id: { $in: Object.keys(membershipDocRecord) },
    });
    const guildDocRecord = guildDocs.reduce<Record<string, GuildDoc>>(
      (prev, guildDoc) => ({
        ...prev,
        [guildDoc._id]: guildDoc,
      }),
      {},
    );

    const promises: Promise<unknown>[] = [];
    for (const [guildId, membershipDocGroup] of Object.entries(membershipDocRecord)) {
      if (membershipDocGroup.length === 0) continue;

      // Initialize membership service
      const guildDoc = guildId in guildDocRecord ? guildDocRecord[guildId] : null;
      const membershipService = new MembershipService(bot);
      await membershipService.initEventLog(guildId, null, guildDoc?.logChannel ?? null);

      // Remove membership
      promises.push(
        ...membershipDocGroup.map((membershipDoc) =>
          DiscordAPI.queue.add(async () =>
            membershipService.removeMembership({
              membershipDoc,
              membershipRoleData: membershipDoc.membershipRole,
              removeReason: `the YouTube OAuth authorization has been revoked.`,
            }),
          ),
        ),
      );
    }

    await Promise.all(promises);

    return res.status(200).send({ message: 'success' });
  };
}

export default UserController;
