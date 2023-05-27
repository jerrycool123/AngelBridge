import {
  CustomRequestHandler,
  ReadCurrentUserRequest,
  RevokeCurrentUserYouTubeRefreshTokenRequest,
} from '@angel-bridge/common';
import { TextChannel } from 'discord.js';

import { symmetricDecrypt } from '../../libs/crypto.js';
import DiscordAPI from '../../libs/discord.js';
import { BadRequestError } from '../../libs/error.js';
import GoogleAPI from '../../libs/google.js';
import {
  fetchGuild,
  fetchGuildOwner,
  fetchLogChannel,
  removeUserMembership,
} from '../../libs/membership.js';
import GuildCollection, { GuildDoc } from '../../models/guild.js';
import { MembershipRoleDoc } from '../../models/membership-role.js';
import MembershipCollection, { OAuthMembershipDoc } from '../../models/membership.js';
import UserCollection from '../../models/user.js';
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
    const refreshToken = symmetricDecrypt(user.youTube.refreshToken);
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
    const oauthMembershipDocs = await MembershipCollection.find<OAuthMembershipDoc>({
      user: user._id,
      type: 'oauth',
    }).populate<{
      membershipRole: MembershipRoleDoc;
    }>('membershipRole');

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

    for (const [guildId, membershipDocGroup] of Object.entries(membershipDocRecord)) {
      if (membershipDocGroup.length === 0) continue;

      // Fetch guild, guild owner and log channel
      const guild = await fetchGuild(guildId);
      const guildOwner = await fetchGuildOwner(guild, false);
      const guildDoc = guildId in guildDocs ? guildDocRecord[guildId] : null;
      let logChannel: TextChannel | null = null;
      if (guildDoc !== null) {
        logChannel = await fetchLogChannel(guild, guildDoc, guildOwner, false);
      }

      // Remove membership
      membershipDocGroup.map((membershipDoc) =>
        DiscordAPI.queue.add(async () =>
          removeUserMembership({
            membershipDoc,
            membershipRoleData: membershipDoc.membershipRole,
            removeReason: `the YouTube OAuth authorization has been revoked.`,
            guild,
            guildOwner,
            logChannel,
          }),
        ),
      );
    }

    return res.status(200).send({ message: 'success' });
  };
}

export default UserController;
