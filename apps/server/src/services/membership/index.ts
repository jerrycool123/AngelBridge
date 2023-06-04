import { Guild, GuildBasedChannel, GuildMember, TextChannel, User } from 'discord.js';

import { BotCheckers, BotCommonUtils } from '../../bot/utils/index.js';
import MembershipRoleCollection, { MembershipRoleDoc } from '../../models/membership-role.js';
import MembershipCollection, { MembershipDoc } from '../../models/membership.js';
import { Bot } from '../../types/bot.js';
import DiscordAPI from '../../utils/discord.js';

export class MembershipService {
  public static groupMembershipDocsByMembershipRole = <T extends MembershipDoc>(
    membershipDocs: T[],
  ): Record<string, T[]> =>
    membershipDocs.reduce<Record<string, T[]>>((prev, membershipDoc) => {
      const roleId = membershipDoc.membershipRole;
      return { ...prev, [roleId]: [...(roleId in prev ? prev[roleId] : []), membershipDoc] };
    }, {});

  constructor(
    private bot: Bot,
    public guild: Guild | null = null,
    public guildOwner: GuildMember | null = null,
    public logChannel: TextChannel | null = null,
  ) {}

  public async initEventLog(guildId: string, logChannelId: string | null): Promise<void> {
    // Fetch guild from Discord bot
    this.guild = await BotCheckers.fetchGuild(this.bot, guildId);

    // Fetch guild owner from Discord bot
    let channel: GuildBasedChannel | null = null;
    if (this.guild !== null) {
      this.guildOwner = await BotCheckers.fetchGuildOwner(this.guild, false);

      // Fetch log channel from Discord bot
      if (logChannelId !== null) {
        try {
          channel = await BotCheckers.fetchChannel(this.guild, logChannelId);
        } catch (error) {
          console.error(error);
        }
      }
    }

    if (channel !== null) {
      if (channel instanceof TextChannel) {
        this.logChannel = channel;
      } else {
        const guildString = this.guild !== null ? `\`${this.guild.name}\`` : `with ID: ${guildId}`;
        await this.sendEventLog(
          `I cannot work properly in your owned server ${guildString}, since the log channel registered in our database is not a text channel.\n` +
            'Please use `/set-log-channel` command to set another log channel for your server.',
        );
      }
    } else if (this.logChannel === null) {
      const guildString = this.guild !== null ? `\`${this.guild.name}\`` : `with ID: ${guildId}`;
      await this.sendEventLog(
        `I cannot work properly in your owned server ${guildString}, since the server does not have a log channel registered in our database.\n` +
          'Thus, I cannot send either OCR verification requests or error messages to your server.\n' +
          'Please use `/set-log-channel` command to set the log channel for your server.',
      );
    }
  }

  public async removeMembership(args: {
    membershipDoc: Pick<MembershipDoc, '_id' | 'user'>;
    membershipRoleData: string | MembershipRoleDoc;
    removeReason: string;
    logOnError?: boolean;
  }): Promise<boolean> {
    // Parse membership role data
    const { membershipDoc, membershipRoleData, removeReason, logOnError = true } = args;
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
    if (this.guild !== null) {
      try {
        const member = await BotCheckers.fetchGuildMember(this.guild, userId, false);
        if (member !== null) {
          user = member.user;
          await member.roles.remove(membershipRoleId);
          roleRemoved = true;
        }
      } catch (error) {
        console.error(error);
        console.error(
          `Failed to remove role with ID: ${membershipRoleId} from user with ID: ${userId} in guild with ID: ${this.guild.id}.`,
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
    try {
      if (user === null) {
        user = await BotCheckers.fetchUser(this.bot, userId, false);
      }

      if (user !== null) {
        await user.send(
          `Your membership role ${membershipRoleString} has been removed, since ${removeReason}.`,
        );
      }
      notified = true;
    } catch (error) {
      // We cannot DM the user, so we just ignore it
      console.error(error);
    }

    // Remove membership record in DB
    await MembershipCollection.findByIdAndDelete(membershipId);

    return notified;
  }

  public async removeMembershipRole(args: {
    membershipDocGroup: MembershipDoc[];
    membershipRoleId: string;
    removeReason: string;
  }): Promise<
    (
      | {
          success: false;
        }
      | {
          success: true;
          value: boolean;
        }
    )[]
  > {
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
    return await Promise.all(
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

  private async sendEventLog(content: string) {
    return await BotCommonUtils.sendEventLog({
      content,
      guildOwner: this.guildOwner,
      logChannel: this.logChannel,
    });
  }
}
