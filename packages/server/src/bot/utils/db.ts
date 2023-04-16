import dayjs from 'dayjs';
import { Guild, Role, User } from 'discord.js';

import GuildCollection from '../../models/guild.js';
import MembershipRoleCollection from '../../models/membership-role.js';
import MembershipCollection from '../../models/membership.js';
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
        allowedMembershipVerificationMethods: {
          oauth: false,
          ocr: true,
        },
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

export const upsertYouTubeChannelCollection = async ({
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
}) => {
  return await YouTubeChannelCollection.findByIdAndUpdate(
    id,
    {
      $set: {
        title,
        description,
        customUrl,
        thumbnail,
      },
      $setOnInsert: {
        _id: id,
      },
    },
    { upsert: true, new: true },
  );
};

export const upsertOCRMembershipCollection = async ({
  userId,
  membershipRoleId,
  expireAt,
}: {
  userId: string;
  membershipRoleId: string;
  expireAt: dayjs.Dayjs;
}) => {
  return await MembershipCollection.findOneAndUpdate(
    {
      user: userId,
      type: 'ocr',
      membershipRole: membershipRoleId,
    },
    {
      $set: {
        billingDate: expireAt.toDate(),
      },
      $setOnInsert: {
        type: 'ocr',
        user: userId,
        membershipRole: membershipRoleId,
      },
    },
    {
      upsert: true,
      new: true,
    },
  );
};

export const upsertUserCollection = async (user: User) => {
  return await UserCollection.findByIdAndUpdate(
    user.id,
    {
      $set: {
        username: `${user.username}#${user.discriminator}`,
        avatar: user.displayAvatarURL(),
      },
      $setOnInsert: { _id: user.id },
    },
    {
      upsert: true,
      new: true,
    },
  );
};
