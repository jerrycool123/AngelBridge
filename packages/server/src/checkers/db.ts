import { NotFoundError } from '../libs/error.js';
import GuildCollection, { GuildDoc } from '../models/guild.js';
import MembershipRoleCollection from '../models/membership-role.js';
import MembershipCollection from '../models/membership.js';
import { YouTubeChannelDoc } from '../models/youtube-channel.js';

namespace DBChecker {
  export const requireGuildWithLogChannel = async (guild: string | GuildDoc) => {
    const guildDoc =
      typeof guild === 'string'
        ? await GuildCollection.findById(guild).orFail(
            new NotFoundError(`The server with ID: ${guild} does not exist in the database.`),
          )
        : guild;
    if (guildDoc.logChannel === null) {
      throw new NotFoundError(
        `This server does not have a log channel.\n` +
          'A server moderator can set a log channel with `/set-log-channel`.',
      );
    }
    return guildDoc as Omit<GuildDoc, 'logChannel'> & {
      logChannel: string;
    };
  };

  export const requireMembershipWithGivenMembershipRole = async (
    userId: string,
    membershipRoleId: string,
  ) => {
    return await MembershipCollection.findOne({
      user: userId,
      membershipRole: membershipRoleId,
    }).orFail(
      new NotFoundError(
        `The member <@${userId}> does not have the membership role <@&${membershipRoleId}>.`,
      ),
    );
  };

  export const requireMembershipRoleWithYouTubeChannel = async (roleId: string) => {
    return await MembershipRoleCollection.findById(roleId)
      .populate<{ youTubeChannel: YouTubeChannelDoc | null }>('youTubeChannel')
      .orFail(new NotFoundError(`The role <@&${roleId}> is not a membership role in the server.`));
  };
}

export default DBChecker;
