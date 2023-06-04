import { CustomRequestHandler, VerifyMembershipRequest } from '@angel-bridge/common';
import { UsersAPI } from '@discordjs/core';
import { REST } from '@discordjs/rest';
import { TextChannel } from 'discord.js';

import { BotEmbeds } from '../../bot/components/embeds.js';
import { bot } from '../../bot/index.js';
import { BotCheckers } from '../../bot/utils/index.js';
import { GuildDoc } from '../../models/guild.js';
import MembershipRoleCollection from '../../models/membership-role.js';
import UserCollection from '../../models/user.js';
import { YouTubeChannelDoc } from '../../models/youtube-channel.js';
import { CryptoUtils } from '../../utils/crypto.js';
import { DBUtils } from '../../utils/db.js';
import DiscordAPI from '../../utils/discord.js';
import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
} from '../../utils/error.js';
import GoogleAPI from '../../utils/google.js';
import { getSession } from '../middlewares/auth.js';

namespace MembershipController {
  export const verifyMembership: CustomRequestHandler<VerifyMembershipRequest> = async (
    req,
    res,
  ) => {
    const { membershipRoleId } = req.params;
    const session = getSession(req);

    // Check if user exists
    const userDoc = await UserCollection.findById(session.id);
    if (userDoc?.refreshToken == null) {
      throw new BadRequestError('You have not authorized with Discord');
    } else if (userDoc.youTube === null) {
      throw new BadRequestError('You have not linked a YouTube channel');
    }
    const discordRefreshToken = CryptoUtils.decrypt(userDoc.refreshToken);
    if (discordRefreshToken === null) {
      throw new InternalServerError('Failed to decrypt Discord refresh token');
    }
    const result = await DiscordAPI.getAccessToken(discordRefreshToken);
    if (!result.success) {
      throw new BadRequestError(
        `An error occurred when trying to refresh your Discord access token: ${result.error}\n` +
          'Please re-login and try again. If the problem persists, please contact the bot owner.',
      );
    }
    const { accessToken, newRefreshToken } = result;
    const newEncryptedDiscordRefreshToken = CryptoUtils.encrypt(newRefreshToken);
    if (newEncryptedDiscordRefreshToken === null) {
      throw new InternalServerError('Failed to encrypt refresh token');
    }
    userDoc.refreshToken = newEncryptedDiscordRefreshToken;
    await userDoc.save();

    // Check if membership role exists
    const membershipRoleDoc = await MembershipRoleCollection.findById(membershipRoleId)
      .populate<{ guild: GuildDoc | null }>('guild')
      .populate<{ youTubeChannel: YouTubeChannelDoc | null }>('youTubeChannel')
      .orFail(new BadRequestError('Membership role not found'));
    if (membershipRoleDoc.guild === null) {
      throw new InternalServerError(
        'Cannot retrieve the server that owns the membership role from the database.\n' +
          'Please contact the bot owner to fix this issue.',
      );
    } else if (membershipRoleDoc.youTubeChannel === null) {
      throw new InternalServerError(
        'Cannot retrieve the corresponding YouTube channel of the membership role from the database.\n' +
          'Please contact the bot owner to fix this issue.',
      );
    }

    // Check if user is a member of the guild that owns the membership role
    const discordRestApi = new REST({ version: '10', authPrefix: 'Bearer' }).setToken(accessToken);
    const discordUsersApi = new UsersAPI(discordRestApi);
    const guilds = await discordUsersApi.getGuilds();
    if (!guilds.some((guild) => guild.id === membershipRoleDoc.guild?._id)) {
      // In order to prevent users from using the website to access guilds that they are not a member of,
      // we will not return an error here. Instead, we will return a not found error.
      throw new BadRequestError('Membership role not found');
    }
    const guildDoc = membershipRoleDoc.guild;

    // Check if the guild exists the bot is in the guild
    const guild = await BotCheckers.fetchGuild(bot, guildDoc._id);
    if (guild === null) {
      throw new BadRequestError(
        `The bot is not in the server '${guildDoc.name}'.\n` +
          'Please contact the server moderators to fix this issue.',
      );
    }
    const member = await BotCheckers.fetchGuildMember(guild, userDoc._id, false);
    if (member === null) {
      throw new BadRequestError('You are not a member of the server.');
    }

    // Check if the membership role exists
    const membershipRole = await BotCheckers.fetchRole(guild, membershipRoleDoc._id);
    if (membershipRole === null) {
      throw new NotFoundError(
        `Failed to retrieve the role '${membershipRoleDoc.name}' from the server.`,
      );
    }

    // Check if the log channel exists and the bot has the required permissions
    if (guildDoc.logChannel === null) {
      throw new BadRequestError(
        `This server does not have a log channel.\n` +
          'Please contact the server moderators to set one up first.',
      );
    }
    const logChannelId = guildDoc.logChannel;
    let logChannel: TextChannel | null = null;
    try {
      logChannel = await BotCheckers.requireGuildHasLogChannel(bot, guild, logChannelId);
    } catch (error) {
      console.error(error);
      throw new BadRequestError(
        'The log channel in this server is not accessible by the bot.\n' +
          'Please contact the server moderators to fix this issue.',
      );
    }

    // OAuth membership check
    const youTubeRefreshToken = CryptoUtils.decrypt(userDoc.youTube.refreshToken);
    if (youTubeRefreshToken === null) {
      throw new InternalServerError('Failed to decrypt YouTube refresh token');
    }
    const randomVideoId =
      membershipRoleDoc.youTubeChannel.memberOnlyVideoIds[
        Math.floor(Math.random() * membershipRoleDoc.youTubeChannel.memberOnlyVideoIds.length)
      ];
    const verifyResult = await GoogleAPI.verifyYouTubeMembership(
      youTubeRefreshToken,
      randomVideoId,
    );
    if (verifyResult.success === false) {
      if (verifyResult.error === 'token_expired_or_revoked') {
        throw new BadRequestError(
          'Your YouTube authorization token has been expired or revoked.\n' +
            'Please link your YouTube channel again.',
        );
      } else if (verifyResult.error === 'forbidden') {
        throw new ForbiddenError('You do not have the YouTube channel membership of this channel');
      } else if (
        verifyResult.error === 'comment_disabled' ||
        verifyResult.error === 'video_not_found'
      ) {
        throw new InternalServerError(
          'Failed to retrieve the members-only video of the YouTube channel.\n' +
            'Please try again. If the problem persists, please contact the bot owner.',
        );
      } else if (verifyResult.error === 'unknown_error') {
        throw new InternalServerError(
          'An unknown error occurred when trying to verify your YouTube membership.\n' +
            'Please try again. If the problem persists, please contact the bot owner.',
        );
      }
    }

    // Add role to member
    try {
      await member.roles.add(membershipRoleDoc._id);
    } catch (error) {
      console.error(error);
      throw new BadRequestError(
        'Sorry, an error occurred while assigning the membership role to you.\n' +
          'Please try again later.',
      );
    }

    // Create or update membership
    const membership = await DBUtils.upsertMembership({
      type: 'oauth',
      userId: member.id,
      membershipRoleId: membershipRoleDoc._id,
    });

    // DM the user
    let notified = false;
    try {
      await member.send({
        content: `You have been granted the membership role **@${membershipRoleDoc.name}** in the server \`${guild.name}\`.`,
      });
      notified = true;
    } catch (error) {
      // User does not allow DMs
    }

    // Send log message
    const oauthMembershipEmbed = BotEmbeds.createOAuthMembershipEmbed(
      member.user,
      membershipRole.id,
    );
    await logChannel.send({
      content: notified
        ? ''
        : "**[NOTE]** Due to the user's __Privacy Settings__ of this server, **I cannot send DM to notify them.**\nYou might need to notify them yourself.",
      embeds: [oauthMembershipEmbed],
    });

    return res.status(201).send({
      id: membership._id.toString(),
      type: 'oauth',
      user: membership.user,
      membershipRole: membership.membershipRole,
      createdAt: membership.createdAt.toISOString(),
      updatedAt: membership.updatedAt.toISOString(),
    });
  };
}

export default MembershipController;
