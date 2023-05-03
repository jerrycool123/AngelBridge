import { CustomRequestHandler, ReadGuildRequest } from '@angel-bridge/common';
import { UsersAPI } from '@discordjs/core';
import { REST } from '@discordjs/rest';

import DiscordUtility from '../../libs/discord.js';
import { BadRequestError } from '../../libs/request-error.js';
import GuildCollection from '../../models/guild.js';
import { MembershipRoleDoc } from '../../models/membership-role.js';
import { MembershipDoc } from '../../models/membership.js';
import UserCollection from '../../models/user.js';
import { YouTubeChannelDoc } from '../../models/youtube-channel.js';
import { getSession } from '../middlewares/auth.js';

namespace GuildController {
  export const readGuilds: CustomRequestHandler<ReadGuildRequest> = async (req, res) => {
    // Check if user has signed in on the website
    const user = getSession(req);
    const userDoc = await UserCollection.findById(user.id).populate<{
      memberships: MembershipDoc[];
    }>('memberships');
    if (userDoc?.refreshToken == null) {
      throw new BadRequestError('You have not authorized with Discord');
    }
    const membershipRecord = userDoc.memberships.reduce<Record<string, MembershipDoc>>(
      (prev, membership) => ({ ...prev, [membership.membershipRole]: membership }),
      {},
    );

    // Get guilds from Discord API
    const result = await DiscordUtility.getAccessToken(userDoc.refreshToken);
    if (!result.success) {
      throw new BadRequestError(result.error);
    }
    const { accessToken, newRefreshToken } = result;
    userDoc.refreshToken = newRefreshToken;

    const discordRestApi = new REST({ version: '10', authPrefix: 'Bearer' }).setToken(accessToken);
    const discordUsersApi = new UsersAPI(discordRestApi);
    const [guilds] = await Promise.all([discordUsersApi.getGuilds(), userDoc.save()]);

    // Get guilds from database
    const guildDocs = await GuildCollection.find({
      _id: { $in: guilds.map((guild) => guild.id) },
    }).populate<{
      membershipRoles: (Omit<MembershipRoleDoc, 'youTubeChannel'> & {
        youTubeChannel: YouTubeChannelDoc | null;
      })[];
    }>({
      path: 'membershipRoles',
      populate: {
        path: 'youTubeChannel',
      },
    });

    return res.status(200).send(
      guildDocs.map((guildDoc) => ({
        id: guildDoc._id,
        name: guildDoc.name,
        icon: guildDoc.icon,
        membershipRoles: guildDoc.membershipRoles
          .filter(
            (
              membershipRoleDoc,
            ): membershipRoleDoc is Omit<MembershipRoleDoc, 'youTubeChannel'> & {
              youTubeChannel: YouTubeChannelDoc;
            } => membershipRoleDoc.youTubeChannel !== null,
          )
          .map((membershipRoleDoc) => {
            const membership =
              membershipRoleDoc._id in membershipRecord
                ? membershipRecord[membershipRoleDoc._id]
                : null;
            return {
              id: membershipRoleDoc._id,
              name: membershipRoleDoc.name,
              color: membershipRoleDoc.color,
              guild: membershipRoleDoc.guild,
              youTubeChannel: {
                id: membershipRoleDoc.youTubeChannel._id,
                title: membershipRoleDoc.youTubeChannel.title,
                description: membershipRoleDoc.youTubeChannel.description,
                customUrl: membershipRoleDoc.youTubeChannel.customUrl,
                thumbnail: membershipRoleDoc.youTubeChannel.thumbnail,
                createdAt: membershipRoleDoc.youTubeChannel.createdAt.toISOString(),
                updatedAt: membershipRoleDoc.youTubeChannel.updatedAt.toISOString(),
              },
              membership:
                membership !== null
                  ? {
                      id: membership._id.toString(),

                      user: membership.user,
                      membershipRole: membership.membershipRole,
                      createdAt: membership.createdAt.toISOString(),
                      updatedAt: membership.updatedAt.toISOString(),
                      ...(membership.type === 'ocr'
                        ? {
                            type: 'ocr',
                            billingDate: membership.billingDate.toISOString(),
                          }
                        : {
                            type: 'oauth',
                          }),
                    }
                  : null,
              createdAt: membershipRoleDoc.createdAt.toISOString(),
              updatedAt: membershipRoleDoc.updatedAt.toISOString(),
            };
          }),
        createdAt: guildDoc.createdAt.toISOString(),
        updatedAt: guildDoc.updatedAt.toISOString(),
      })),
    );
  };
}

export default GuildController;
