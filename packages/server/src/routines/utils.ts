import { Guild, GuildMember, TextChannel, User } from 'discord.js';

import BotChecker from '../checkers/bot.js';
import DiscordAPI from '../libs/discord.js';
import { GuildDoc } from '../models/guild.js';
import MembershipRoleCollection, { MembershipRoleDoc } from '../models/membership-role.js';
import MembershipCollection, { MembershipDoc } from '../models/membership.js';

export type GuildInfo =
  | {
      type: 'guild';
      data: Guild;
    }
  | {
      type: 'partialGuild';
      data: Pick<Guild, 'id' | 'name'>;
    };

export const groupMembershipDocsByMembershipRole = <T extends MembershipDoc>(
  membershipDocs: T[],
): Record<string, T[]> =>
  membershipDocs.reduce<Record<string, T[]>>((prev, membershipDoc) => {
    const roleId = membershipDoc.membershipRole;
    return { ...prev, [roleId]: [...(roleId in prev ? prev[roleId] : []), membershipDoc] };
  }, {});

export const fetchGuild = async (guildId: string) => {
  try {
    return await BotChecker.requireGuild(guildId);
  } catch (error) {
    console.error(error);
    console.error(`Failed to fetch guild with ID: ${guildId} from Discord API.`);
  }
  return null;
};

export const fetchGuildOwner = async (guild: Guild | null) => {
  // Return null if the guild does not exist
  if (guild === null) return null;

  try {
    return await BotChecker.requireGuildOwner(guild);
  } catch (error) {
    console.error(error);
    console.error(
      `Failed to fetch guild owner of guild ${guild.name}(ID: ${guild.id}) from Discord API. `,
    );
  }
  return null;
};

export const fetchLogChannel = async (
  guild: Guild | null,
  guildDoc: GuildDoc,
  guildOwner: GuildMember | null,
) => {
  // Return null if the guild does not exist
  if (guild === null) return null;

  // If the guild exists and is stored in DB, we try to fetch the log channel
  if (guildDoc.logChannel !== null) {
    try {
      return await BotChecker.requireGuildHasLogChannel(guild, guildDoc.logChannel);
    } catch (error) {
      console.error(error);
      console.error(
        `Failed to fetch log channel with ID: ${guildDoc.logChannel} from Discord API.`,
      );
    }
  }

  // Otherwise, we try to DM the guild owner about the error
  if (guildOwner === null) return null;
  try {
    await guildOwner.send(
      `I cannot work properly in your owned server ${guild.name}, since the server does not have a log channel registered in our database.\n` +
        'Thus, we cannot send either OCR verification requests or error messages to your server.\n' +
        'Please use `/set-log-channel` command to set the log channel for your server.',
    );
  } catch (error) {
    // We cannot DM the owner, so we just ignore it
    console.error(error);
  }
  return null;
};

export const notifyAdminError = async (
  content: string,
  guildOwner?: GuildMember | null,
  logChannel?: TextChannel | null,
) => {
  let logged = false;

  // Try to send log to the log channel
  if (logChannel != null) {
    try {
      await logChannel.send(content);
      logged = true;
    } catch (error) {
      // We cannot send error to the log channel, so we just ignore it
      console.error(error);
    }
  }

  // If the log is failed to send, try to DM the guild owner about the removal
  if (logged === false && guildOwner != null) {
    try {
      await guildOwner.send(content);
      logged = true;
    } catch (error) {
      // We cannot DM the owner, so we just ignore it
      console.error(error);
    }
  }

  return logged;
};

export const cleanUpMissingMembershipRole = async (
  membershipRoleId: string,
  membershipDocGroup: MembershipDoc[],
  removeReason: string,
  guildOwner?: GuildMember | null,
  logChannel?: TextChannel | null,
) => {
  // Remove the membership role and memberships from DB
  const membershipDocIds = membershipDocGroup.map(({ _id }) => _id.toString());
  const [membershipRoleDoc] = await Promise.all([
    MembershipRoleCollection.findByIdAndDelete(membershipRoleId),
    MembershipCollection.deleteMany({ _id: { $in: membershipDocIds } }),
  ]);
  const membershipRoleString =
    membershipRoleDoc !== null ? `**@${membershipRoleDoc.name}**` : `<@${membershipRoleId}>`;

  // Notify admin about the cleanup
  await notifyAdminError(
    `The membership role ${membershipRoleString} has been removed, since ${removeReason}.\n` +
      'I will try to remove the role from the members, but if I failed to do so, please remove the role manually.\n' +
      'If you believe this is an error, please contact the bot owner to resolve this issue.',
    guildOwner,
    logChannel,
  );

  return membershipDocGroup.map((membershipDoc) =>
    DiscordAPI.addJob(async () => {
      // Try to remove the membership role from the user
      const userId = membershipDoc.user;
      const guild = guildOwner?.guild ?? null;
      let user: User | null = null;
      if (guild !== null) {
        const guildId = guild.id;
        try {
          const member = await BotChecker.requireGuildMember(guild, userId);
          user = member.user;
          await member.roles.remove(membershipRoleId);
        } catch (error) {
          console.error(error);
          console.error(
            `Failed to remove role with ID: ${membershipRoleId} from user with ID: ${userId} in guild with ID: ${guildId}.`,
          );
        }
      }

      // DM user about the removal
      try {
        if (user === null) {
          user = await BotChecker.requireUser(userId);
        }
        await user.send(
          `Your membership role ${membershipRoleString} has been removed, since ${removeReason}.`,
        );
      } catch (error) {
        // We cannot DM the user, so we just ignore it
        console.error(error);
      }
    }),
  );
};

export const removeUserMembership = async ({
  membershipDoc: { _id: membershipId, user: userId, type },
  membershipRoleDoc: { _id: membershipRoleId, name: membershipRoleName },
  guildInfo,
  guildOwner,
  logChannel,
}: {
  membershipDoc: MembershipDoc;
  membershipRoleDoc: MembershipRoleDoc;
  guildInfo: GuildInfo;
  guildOwner: GuildMember | null;
  logChannel: TextChannel | null;
}) => {
  // Remove the role from the user
  const { id: guildId, name: guildName } = guildInfo.data;
  let user: User | null = null;
  let roleRemoved = false;
  if (guildInfo.type === 'guild') {
    const { data: guild } = guildInfo;
    try {
      const member = await BotChecker.requireGuildMember(guild, userId);
      user = member.user;
      await member.roles.remove(membershipRoleId);
      roleRemoved = true;
    } catch (error) {
      console.error(error);
      console.error(
        `Failed to remove role with ID: ${membershipRoleId} from user with ID: ${userId} in guild with ID: ${guildId}.`,
      );
    }
  }

  // If the role is not removed, notify admin about the error
  if (roleRemoved === false) {
    await notifyAdminError(
      `I cannot remove the membership role \`${membershipRoleName}\` from the user <@${userId}> due to one of the following reasons:\n` +
        '- The user has left the server\n' +
        '- The membership role has been removed from the server\n' +
        '- The bot does not have the permission to manage roles\n' +
        '- The bot is no longer in the server\n' +
        '- Other unknown bot error\n' +
        '\nIf you believe this is an unexpected error, please check if every settings is fine, or contact the bot owner to resolve this issue.',
      guildOwner,
      logChannel,
    );
  }

  // Notify user about the removal
  try {
    if (user === null) {
      user = await BotChecker.requireUser(userId);
    }
    await user.send(
      type === 'ocr'
        ? `Your membership role **@${membershipRoleName}** has expired.\n` +
            `Please use \`/verify\` command to renew your membership in the server \`${guildName}\`.`
        : `Your membership role **@${membershipRoleName}** has been removed, ` +
            'since we cannot verify your membership from YouTube API.',
    );
  } catch (error) {
    // We cannot DM the user, so we just ignore it
    console.error(error);
  }

  // Remove membership record in DB
  await MembershipCollection.findByIdAndDelete(membershipId);
};
