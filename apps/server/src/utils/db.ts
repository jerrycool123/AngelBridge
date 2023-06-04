import dayjs from 'dayjs';

import GuildCollection, { GuildDoc } from '../models/guild.js';
import MembershipRoleCollection, { MembershipRoleDoc } from '../models/membership-role.js';
import {
  MembershipDoc,
  OAuthMembershipCollection,
  OAuthMembershipDoc,
  OCRMembershipCollection,
  OCRMembershipDoc,
} from '../models/membership.js';
import UserCollection, { UserDoc } from '../models/user.js';
import YouTubeChannelCollection, { YouTubeChannelDoc } from '../models/youtube-channel.js';
import { UserMeta } from '../types/common.js';

export class DBUtils {
  public static async upsertGuild(guild: {
    id: string;
    name: string;
    icon: string | null;
    logChannel?: string | null;
  }): Promise<GuildDoc> {
    return await GuildCollection.findByIdAndUpdate(
      guild.id,
      {
        $set: {
          name: guild.name,
          icon: guild.icon,
          ...(guild.logChannel !== undefined && {
            logChannel: guild.logChannel,
          }),
        },
        $setOnInsert: {
          _id: guild.id,
        },
      },
      {
        upsert: true,
        new: true,
      },
    );
  }

  public static async updateMembershipRole(role: {
    id: string;
    name: string;
    color: number;
  }): Promise<MembershipRoleDoc | null> {
    return await MembershipRoleCollection.findByIdAndUpdate(
      role.id,
      {
        $set: {
          name: role.name,
          color: role.color,
        },
      },
      {
        new: true,
      },
    );
  }

  public static async upsertYouTubeChannel(
    {
      id,
      title,
      description,
      customUrl,
      thumbnail,
    }: {
      id: string;
      title: string;
      description: string;
      customUrl: string;
      thumbnail: string;
    },
    memberOnlyVideoIds: string[],
  ): Promise<YouTubeChannelDoc> {
    return await YouTubeChannelCollection.findByIdAndUpdate(
      id,
      {
        $set: {
          title,
          description,
          customUrl,
          thumbnail,
          memberOnlyVideoIds,
        },
        $setOnInsert: {
          _id: id,
        },
      },
      { upsert: true, new: true },
    );
  }

  public static async upsertMembership(
    props: {
      userId: string;
      membershipRoleId: string;
    } & (
      | {
          type: 'ocr';
          expireAt: dayjs.Dayjs;
        }
      | {
          type: 'oauth';
        }
    ),
  ): Promise<MembershipDoc> {
    const { type, userId, membershipRoleId } = props;
    if (type === 'oauth') {
      const [oauthMembershipDoc] = await Promise.all([
        OAuthMembershipCollection.findOneAndUpdate<OAuthMembershipDoc>(
          {
            user: userId,
            membershipRole: membershipRoleId,
          },
          {
            $set: {
              type,
            },
            $unset: {
              billingDate: 1,
            },
            $setOnInsert: {
              user: userId,
              membershipRole: membershipRoleId,
            },
          },
          {
            upsert: true,
            new: true,
          },
        ) as Promise<OAuthMembershipDoc>,
        OCRMembershipCollection.deleteOne({
          user: userId,
          membershipRole: membershipRoleId,
        }),
      ]);
      return oauthMembershipDoc;
    } else if (type === 'ocr') {
      const { expireAt } = props;
      const [ocrMembershipDoc] = await Promise.all([
        OCRMembershipCollection.findOneAndUpdate(
          {
            user: userId,
            membershipRole: membershipRoleId,
          },
          {
            $set: {
              type,
              billingDate: expireAt.toDate(),
            },
            $setOnInsert: {
              user: userId,
              membershipRole: membershipRoleId,
            },
          },
          {
            upsert: true,
            new: true,
          },
        ) as Promise<OCRMembershipDoc>,
        OAuthMembershipCollection.deleteOne({
          user: userId,
          membershipRole: membershipRoleId,
        }),
      ]);
      return ocrMembershipDoc;
    }
    throw new Error('Unsupported membership type');
  }

  public static async upsertUser({
    id,
    username,
    avatar,
    refreshToken,
  }: UserMeta & {
    refreshToken?: Buffer;
  }): Promise<UserDoc> {
    return await UserCollection.findByIdAndUpdate(
      id,
      {
        $set: {
          username,
          avatar,
          ...(refreshToken !== undefined && { refreshToken }),
        },
        $setOnInsert: { _id: id },
      },
      {
        upsert: true,
        new: true,
      },
    );
  }
}
