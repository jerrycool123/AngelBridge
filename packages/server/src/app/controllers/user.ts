import {
  CustomRequestHandler,
  ReadCurrentUserRequest,
  RevokeCurrentUserYouTubeRefreshTokenRequest,
} from '@angel-bridge/common';

// import { Guild } from 'discord.js';
// import client from '../../bot/index.js';
// import { badRequestValidator } from '../../bot/utils/validator.js';
import { symmetricDecrypt } from '../../libs/crypto.js';
// import DiscordAPI from '../../libs/discord.js';
import { BadRequestError } from '../../libs/error.js';
import GoogleAPI from '../../libs/google.js';
// import { MembershipRoleDoc } from '../../models/membership-role.js';
// import MembershipCollection from '../../models/membership.js';
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
    const result = await GoogleAPI.revokeRefreshToken(oauth2Client, refreshToken);
    if (!result.success) {
      throw new BadRequestError(result.error);
    }
    user.youTube = null;
    await user.save();

    // Retrieve User's OAuth memberships in DB
    // const oauthMembershipDocs = await MembershipCollection.find({
    //   user: user._id,
    //   type: 'oauth',
    // }).populate<{
    //   membershipRole: MembershipRoleDoc;
    // }>('membershipRole');
    // oauthMembershipDocs.map(({ guild: guildId }) =>
    //   DiscordAPI.addJob(async () => {
    //     const guild = await badRequestValidator.requireGuild(guildId);
    //   }),
    // );

    return res.status(200).send({ message: 'success' });
  };
}

export default UserController;
