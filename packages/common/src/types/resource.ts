export type MembershipResource = {
  id: string;
  user: string;
  membershipRole: string;
  createdAt: string;
  updatedAt: string;
} & (
  | {
      type: 'ocr';
      billingDate: string;
    }
  | {
      type: 'oauth';
    }
);

export interface MembershipRoleResource {
  id: string;
  name: string;
  color: number;
  guild: string;
  youTubeChannel: string;
  createdAt: string;
  updatedAt: string;
}

export interface GuildResource {
  id: string;
  name: string;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserResource {
  id: string;
  username: string;
  avatar: string;
  youTube: {
    id: string;
    title: string;
    customUrl: string;
    thumbnail: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface YouTubeChannelResource {
  id: string;
  title: string;
  description: string;
  customUrl: string;
  thumbnail: string;
  createdAt: string;
  updatedAt: string;
}
