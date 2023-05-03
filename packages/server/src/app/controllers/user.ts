import { CustomRequestHandler, ReadCurrentUserRequest } from '@angel-bridge/common';

import { BadRequestError } from '../../libs/request-error.js';
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
}

export default UserController;
