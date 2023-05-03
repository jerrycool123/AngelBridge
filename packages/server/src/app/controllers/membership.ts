import { CustomRequestHandler, VerifyMembershipRequest } from '@angel-bridge/common';
import { UsersAPI } from '@discordjs/core';
import { REST } from '@discordjs/rest';
import { EmbedBuilder, Guild, GuildMember, PermissionFlagsBits, TextChannel } from 'discord.js';
import { google } from 'googleapis';

import client from '../../bot/index.js';
import { upsertMembershipCollection } from '../../bot/utils/db.js';
import DiscordUtility from '../../libs/discord.js';
import GoogleUtility from '../../libs/google.js';
import { BadRequestError, InternalServerError } from '../../libs/request-error.js';
import { GuildDoc } from '../../models/guild.js';
import MembershipRoleCollection from '../../models/membership-role.js';
import UserCollection from '../../models/user.js';
import { YouTubeChannelDoc } from '../../models/youtube-channel.js';
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
    const result = await DiscordUtility.getAccessToken(userDoc.refreshToken);
    if (!result.success) {
      throw new BadRequestError(
        `An error occurred when trying to refresh your Discord access token: ${result.error}\n` +
          'Please re-login and try again. If the problem persists, please contact the bot owner.',
      );
    }
    const { accessToken, newRefreshToken } = result;
    userDoc.refreshToken = newRefreshToken;
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
    let guild: Guild | null = null,
      botUser: GuildMember | null = null;
    try {
      guild = await client.guilds.fetch(guildDoc._id);
      botUser = await guild.members.fetchMe();
      if (botUser === null) {
        throw new Error('Bot user not found');
      }
    } catch (error) {
      throw new BadRequestError(
        `The bot is not in the server '${guildDoc.name}'.\n` +
          'Please contact the server moderators to fix this issue.',
      );
    }
    let member: GuildMember | null = null;
    try {
      member = await guild.members.fetch(userDoc._id);
    } catch (error) {
      throw new BadRequestError('You are not a member of the server');
    }

    // Check if the membership role exists
    const membershipRole = await guild.roles.fetch(membershipRoleDoc._id);
    if (membershipRole === null) {
      throw new BadRequestError(
        'Cannot retrieve the membership role from the server.\n' +
          'Please contact the bot owner to fix this issue.',
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
    const logChannel = await guild.channels.fetch(logChannelId, { force: true });
    if (logChannel === null) {
      throw new BadRequestError(
        `Cannot retrieve the log channel in the server '${guildDoc.name}'.\n` +
          'Please contact the server moderators to fix this issue.',
      );
    } else if (
      !(logChannel instanceof TextChannel) ||
      !(logChannel.permissionsFor(botUser)?.has(PermissionFlagsBits.ViewChannel) ?? false) ||
      !(logChannel.permissionsFor(botUser)?.has(PermissionFlagsBits.SendMessages) ?? false)
    ) {
      throw new BadRequestError(
        `The log channel in the server is invalid.\n` +
          'Please contact the server moderators to fix this issue.',
      );
    }

    // OAuth membership check
    const oauth2Client = GoogleUtility.createOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: userDoc.youTube.refreshToken });
    const youTubeApi = google.youtube({ version: 'v3', auth: oauth2Client });
    try {
      await youTubeApi.commentThreads.list({
        part: ['id'],
        videoId:
          membershipRoleDoc.youTubeChannel.memberOnlyVideoIds[
            Math.floor(Math.random() * membershipRoleDoc.youTubeChannel.memberOnlyVideoIds.length)
          ],
        maxResults: 1,
      });
    } catch (error) {
      // We assume that user does not have the YouTube channel membership if the API call fails
      throw new BadRequestError('Failed to verify your YouTube membership of this channel');
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
    const membership = await upsertMembershipCollection({
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
    await logChannel.send({
      content: notified
        ? ''
        : "**[NOTE]** Due to the user's __Privacy Settings__ of this server, **I cannot send DM to notify them.**\nYou might need to notify them yourself.",
      embeds: [
        new EmbedBuilder()
          .setAuthor({
            name: userDoc.username,
            iconURL: userDoc.avatar,
          })
          .setTitle('New OAuth Membership')
          .addFields([
            {
              name: 'Membership Role',
              value: `<@&${membershipRole.id}>`,
              inline: true,
            },
          ])
          .setTimestamp()
          .setColor('#57F287')
          .setFooter({ text: `User ID: ${member.id}` }),
      ],
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
