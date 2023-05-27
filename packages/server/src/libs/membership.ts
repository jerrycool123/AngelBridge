import { Guild, GuildMember, TextChannel, User } from 'discord.js';

import { BotChecker } from '../checkers/bot.js';
import { GuildDoc } from '../models/guild.js';
import MembershipRoleCollection, { MembershipRoleDoc } from '../models/membership-role.js';
import MembershipCollection, { MembershipDoc } from '../models/membership.js';
import DiscordAPI from './discord.js';

export type MembershipHandlingConfig = Partial<{
  guild: Guild | null;
  guildOwner: GuildMember | null;
  logChannel: TextChannel | null;
}>;

export const groupMembershipDocsByMembershipRole = <T extends MembershipDoc>(
  membershipDocs: T[],
): Record<string, T[]> =>
  membershipDocs.reduce<Record<string, T[]>>((prev, membershipDoc) => {
    const roleId = membershipDoc.membershipRole;
    return { ...prev, [roleId]: [...(roleId in prev ? prev[roleId] : []), membershipDoc] };
  }, {});

export const fetchGuild = async (guildId: string, force?: boolean) => {
  try {
    return await BotChecker.requireGuild(guildId, force);
  } catch (error) {
    console.error(error);
    console.error(`Failed to fetch guild with ID: ${guildId} from Discord API.`);
  }
  return null;
};

export const fetchGuildOwner = async (guild: Guild | null, force?: boolean) => {
  // Return null if the guild does not exist
  if (guild === null) return null;

  try {
    return await BotChecker.requireGuildOwner(guild, force);
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
  force?: boolean,
) => {
  // Return null if the guild does not exist
  if (guild === null) return null;

  // If the guild exists and is stored in DB, we try to fetch the log channel
  if (guildDoc.logChannel !== null) {
    try {
      return await BotChecker.requireGuildHasLogChannel(guild, guildDoc.logChannel, force);
    } catch (error) {
      console.error(error);
      console.error(
        `Failed to fetch log channel with ID: ${guildDoc.logChannel} from Discord API.`,
      );
    }
  }

  // Notify admin about the error
  await notifyAdminError({
    content:
      `I cannot work properly in your owned server ${guild.name}, since the server does not have a log channel registered in our database.\n` +
      'Thus, we cannot send either OCR verification requests or error messages to your server.\n' +
      'Please use `/set-log-channel` command to set the log channel for your server.',
    guildOwner,
    logChannel: null,
  });

  return null;
};

export const notifyAdminError = async ({
  content,
  guildOwner,
  logChannel,
}: {
  content: string;
} & Pick<MembershipHandlingConfig, 'guildOwner' | 'logChannel'>) => {
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
      await guildOwner.send(
        `> I cannot send error log to the log channel in your server \`${guildOwner.guild.name}\`.\n` +
          `> Please make sure that the log channel is set with \`/set-log-channel\`, and that I have enough permissions to send messages in it.\n` +
          content,
      );
      logged = true;
    } catch (error) {
      // We cannot DM the owner, so we just ignore it
      console.error(error);
    }
  }

  return logged;
};

export const removeMembershipRole = async (
  args: {
    membershipDocGroup: MembershipDoc[];
    membershipRoleId: string;
    removeReason: string;
  } & MembershipHandlingConfig,
) => {
  // Remove the membership role and memberships from DB
  const { membershipDocGroup, membershipRoleId, removeReason, ...rest } = args;
  const membershipDocIds = membershipDocGroup.map(({ _id }) => _id.toString());
  const [membershipRoleDoc] = await Promise.all([
    MembershipRoleCollection.findByIdAndDelete(membershipRoleId),
    MembershipCollection.deleteMany({ _id: { $in: membershipDocIds } }),
  ]);
  const membershipRoleString =
    membershipRoleDoc !== null ? `**@${membershipRoleDoc.name}**` : `<@${membershipRoleId}>`;

  // Notify admin about the removal
  await notifyAdminError({
    content:
      `The membership role ${membershipRoleString} has been removed, since ${removeReason}.\n` +
      'I will try to remove the role from the members, but if I failed to do so, please remove the role manually.\n' +
      'If you believe this is an error, please contact the bot owner to resolve this issue.',
    ...rest,
  });

  // Remove the membership role from the users
  return membershipDocGroup.map((membershipDoc) =>
    DiscordAPI.queue.add(async () =>
      removeUserMembership({
        membershipDoc,
        membershipRoleData: membershipRoleDoc ?? membershipRoleId,
        removeReason,
        notifyAdmin: false,
        ...rest,
      }),
    ),
  );
};

export const removeUserMembership = async (
  args: {
    membershipDoc: Pick<MembershipDoc, '_id' | 'user'>;
    membershipRoleData: string | MembershipRoleDoc;
    removeReason: string;
    notifyAdmin?: boolean;
  } & MembershipHandlingConfig,
) => {
  // Parse membership role data
  const {
    membershipDoc,
    membershipRoleData,
    removeReason,
    notifyAdmin = true,
    guild,
    ...rest
  } = args;
  let membershipRoleId: string, membershipRoleString: string;
  if (typeof membershipRoleData === 'string') {
    membershipRoleId = membershipRoleData;
    membershipRoleString = `<@&${membershipRoleId}>`;
  } else {
    membershipRoleId = membershipRoleData._id;
    membershipRoleString = `**@${membershipRoleData.name}**`;
  }

  // Remove the role from the user
  const { _id: membershipId, user: userId } = membershipDoc;
  let user: User | null = null;
  let roleRemoved = false;
  if (guild != null) {
    const guildId = guild.id;
    try {
      const member = await BotChecker.requireGuildMember(guild, userId, false);
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
  if (notifyAdmin === true && roleRemoved === false) {
    await notifyAdminError({
      content:
        `I cannot remove the membership role ${membershipRoleString} from the user <@${userId}> due to one of the following reasons:\n` +
        '- The user has left the server\n' +
        '- The membership role has been removed from the server\n' +
        '- The bot does not have the permission to manage roles\n' +
        '- The bot is no longer in the server\n' +
        '- Other unknown bot error\n' +
        '\nIf you believe this is an unexpected error, please check if every settings is fine, or contact the bot owner to resolve this issue.',
      ...rest,
    });
  }

  // DM user about the removal
  let notified = false;
  try {
    if (user === null) {
      user = await BotChecker.requireUser(userId, false);
    }
    await user.send(
      `Your membership role ${membershipRoleString} has been removed, since ${removeReason}.`,
    );
    notified = true;
  } catch (error) {
    // We cannot DM the user, so we just ignore it
    console.error(error);
  }

  // Remove membership record in DB
  await MembershipCollection.findByIdAndDelete(membershipId);

  return notified;
};
