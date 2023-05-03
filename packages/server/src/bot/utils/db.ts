import dayjs from 'dayjs';
import { Guild, Role, User } from 'discord.js';

import GuildCollection from '../../models/guild.js';
import MembershipRoleCollection from '../../models/membership-role.js';
import {
  MembershipDoc,
  OAuthMembershipCollection,
  OAuthMembershipDoc,
  OCRMembershipCollection,
  OCRMembershipDoc,
} from '../../models/membership.js';
import UserCollection from '../../models/user.js';
import YouTubeChannelCollection from '../../models/youtube-channel.js';

export const upsertGuildCollection = async (guild: Guild) => {
  return await GuildCollection.findByIdAndUpdate(
    guild.id,
    {
      $set: {
        name: guild.name,
        icon: guild.iconURL(),
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
};

export const updateMembershipRoleCollection = async (role: Role) => {
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
};

export const upsertYouTubeChannelCollection = async (
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
) => {
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
};

export const upsertMembershipCollection = async (
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
): Promise<MembershipDoc> => {
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
};

export const upsertUserCollection = async (
  user: Pick<User, 'id' | 'username' | 'discriminator'>,
  avatar: string,
  refreshToken?: string,
) => {
  return await UserCollection.findByIdAndUpdate(
    user.id,
    {
      $set: {
        username: `${user.username}#${user.discriminator}`,
        avatar,
        ...(refreshToken !== undefined && { refreshToken }),
      },
      $setOnInsert: { _id: user.id },
    },
    {
      upsert: true,
      new: true,
    },
  );
};
