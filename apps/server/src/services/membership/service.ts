import dayjs from 'dayjs';
import { ChannelType, EmbedBuilder, Guild, GuildMember, Role, TextChannel } from 'discord.js';

import { BotCheckers, BotCommonUtils } from '../../bot/utils/index.js';
import MembershipRoleCollection, { MembershipRoleDoc } from '../../models/membership-role.js';
import MembershipCollection, { MembershipDoc } from '../../models/membership.js';
import { Bot } from '../../types/bot.js';
import { DBUtils } from '../../utils/db.js';
import DiscordAPI from '../../utils/discord.js';
import { InternalServerError } from '../../utils/error.js';

export class MembershipService {
  public guild: Guild | null = null;
  public guildOwner: GuildMember | null = null;
  public logChannel: TextChannel | null = null;

  constructor(private bot: Bot<true>) {}

  public async initEventLog(
    guildData: string | Guild,
    guildOwner: GuildMember | null,
    logChannelData: string | TextChannel | null,
  ): Promise<void> {
    if (guildData instanceof Guild) {
      this.guild = guildData;
    } else {
      // Fetch guild from Discord bot
      this.guild = await BotCheckers.fetchGuild(this.bot, guildData);
    }

    if (guildOwner instanceof GuildMember) {
      this.guildOwner = guildOwner;
    } else if (this.guild !== null) {
      // Fetch guild owner from Discord bot
      this.guildOwner = await BotCheckers.fetchGuildOwner(this.guild, false);
    }

    if (logChannelData instanceof TextChannel) {
      this.logChannel = logChannelData;
    } else if (this.guild !== null && logChannelData !== null) {
      // Fetch log channel from Discord bot
      const channel = await BotCheckers.fetchChannel(this.guild, logChannelData, false);
      if (channel !== null && channel.type === ChannelType.GuildText) {
        this.logChannel = channel;
      } else {
        await this.sendEventLog(
          'The server log channel registered in our database is not a text channel.',
        );
      }
    }

    if (this.logChannel === null) {
      await this.sendEventLog('The server does not have a log channel registered in our database.');
    }
  }

  public async addMembership<
    TMembership extends
      | {
          type: 'ocr';
          expireAt: dayjs.Dayjs;
        }
      | {
          type: 'oauth';
        },
  >(args: {
    member: GuildMember;
    membership: TMembership;
    guild: Guild;
    membershipRole: Pick<Role, 'id' | 'name'>;
  }): Promise<{
    notified: boolean;
    updatedMembership: Extract<
      MembershipDoc,
      TMembership extends {
        type: 'oauth';
      }
        ? { type: 'oauth' }
        : { type: 'ocr' }
    >;
  }> {
    const { member, membership, guild, membershipRole } = args;

    // Add role to member
    try {
      await member.roles.add(membershipRole.id);
    } catch (error) {
      console.error(error);
      throw new InternalServerError('Failed to add the role to the member.');
    }

    // Create or update membership
    const updatedMembership = await DBUtils.upsertMembership({
      ...membership,
      userId: member.id,
      membershipRoleId: membershipRole.id,
    });

    // DM the user
    let notified = false;
    try {
      await member.send({
        content: `You have been manually granted the membership role **@${membershipRole.name}** in the server \`${guild.name}\`.`,
      });
      notified = true;
    } catch (error) {
      // User does not allow DMs
    }

    return {
      notified,
      updatedMembership: updatedMembership as Extract<
        MembershipDoc,
        TMembership extends {
          type: 'oauth';
        }
          ? { type: 'oauth' }
          : { type: 'ocr' }
      >,
    };
  }

  public async removeMembership(args: {
    membershipDoc: Pick<MembershipDoc, '_id' | 'user'>;
    membershipRoleData: string | MembershipRoleDoc | Pick<Role, 'id' | 'name'>;
    removeReason: string;
    logOnError?: boolean;
  }): Promise<boolean> {
    const { membershipDoc, membershipRoleData, removeReason, logOnError = true } = args;

    // Parse membership role data
    let membershipRoleId: string, membershipRoleString: string;
    if (typeof membershipRoleData === 'string') {
      membershipRoleId = membershipRoleData;
      membershipRoleString = `<@&${membershipRoleId}> (ID: ${membershipRoleId})`;
    } else if (!('_id' in membershipRoleData)) {
      membershipRoleId = membershipRoleData.id;
      membershipRoleString = `**@${membershipRoleData.name}**`;
    } else {
      membershipRoleId = membershipRoleData._id;
      membershipRoleString = `**@${membershipRoleData.name}**`;
    }

    // Remove the role from the user
    const { _id: membershipId, user: userId } = membershipDoc;
    let member: GuildMember | null = null;
    let roleRemoved = false;
    if (member === null && this.guild !== null) {
      member = await BotCheckers.fetchGuildMember(this.guild, userId, false);
    }
    if (member !== null) {
      try {
        await member.roles.remove(membershipRoleId);
        roleRemoved = true;
      } catch (error) {
        console.error(error);
        console.error(
          `Failed to remove role with ID: ${membershipRoleId} from user with ID: ${userId} in guild with ID: ${member.guild.id}.`,
        );
      }
    }

    // If the role is not removed, notify admin about the error
    if (logOnError === true && roleRemoved === false) {
      await this.sendEventLog(
        `I cannot remove the membership role ${membershipRoleString} from the user <@${userId}> due to one of the following reasons:\n` +
          '- The user has left the server\n' +
          '- The membership role has been removed from the server\n' +
          '- The bot does not have the permission to manage roles\n' +
          '- The bot is no longer in the server\n' +
          '- Other unknown bot error\n' +
          '\nIf you believe this is an unexpected error, please check if every settings is fine, or contact the bot owner to resolve this issue.',
      );
    }

    // DM user about the removal
    let notified = false;
    if (member !== null) {
      try {
        await member.send(
          `Your membership role ${membershipRoleString} has been removed, since ${removeReason}.`,
        );

        notified = true;
      } catch (error) {
        // We cannot DM the user, so we just ignore it
        console.error(error);
      }
    }

    // Remove membership record in DB
    await MembershipCollection.findByIdAndDelete(membershipId);

    return notified;
  }

  public async removeMembershipRole(args: {
    membershipDocGroup: MembershipDoc[];
    membershipRoleId: string;
    removeReason: string;
  }): Promise<void> {
    // Remove the membership role and memberships from DB
    const { membershipDocGroup, membershipRoleId, removeReason } = args;
    const membershipDocIds = membershipDocGroup.map(({ _id }) => _id.toString());
    const [membershipRoleDoc] = await Promise.all([
      MembershipRoleCollection.findByIdAndDelete(membershipRoleId),
      MembershipCollection.deleteMany({ _id: { $in: membershipDocIds } }),
    ]);
    const membershipRoleString =
      membershipRoleDoc !== null ? `**@${membershipRoleDoc.name}**` : `<@${membershipRoleId}>`;

    // Notify admin about the removal
    await this.sendEventLog(
      `The membership role ${membershipRoleString} has been removed, since ${removeReason}.\n` +
        'I will try to remove the role from the members, but if I failed to do so, please remove the role manually.\n' +
        'If you believe this is an error, please contact the bot owner to resolve this issue.',
    );

    // Remove the membership role from the users
    await Promise.all(
      membershipDocGroup.map((membershipDoc) =>
        DiscordAPI.queue.add(async () =>
          this.removeMembership({
            membershipDoc,
            membershipRoleData: membershipRoleDoc ?? membershipRoleId,
            removeReason,
            // We don't want to spam the removal log for each membership, since we have already logged it once above.
            logOnError: false,
          }),
        ),
      ),
    );
  }

  public async sendEventLog(content: string, embeds?: EmbedBuilder[]) {
    return await BotCommonUtils.sendEventLog({
      content,
      embeds,
      guildOwner: this.guildOwner,
      logChannel: this.logChannel,
    });
  }
}
