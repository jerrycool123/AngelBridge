import { Document, Model, Schema, model } from 'mongoose';

import { SupportedOCRLanguage } from '../types/common.js';

export interface UserAttrs {
  _id: string; // Discord ID
  username: string;
  avatar: string;
}

export interface UserDoc extends UserAttrs, Document<string> {
  _id: string;
  lastVerifyingRoleId: string | null;
  language: SupportedOCRLanguage['language'];
  refreshToken: Buffer | null;
  youTube: {
    id: string;
    title: string;
    customUrl: string;
    thumbnail: string;
    refreshToken: Buffer;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UserModel extends Model<UserDoc> {
  build: (attrs: UserAttrs) => Promise<UserDoc>;
}

const userSchema = new Schema<UserDoc>(
  {
    _id: String,
    username: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      required: true,
    },
    lastVerifyingRoleId: {
      type: String,
      default: null,
    },
    language: {
      type: String,
      required: true,
      default: 'English',
    },
    refreshToken: {
      type: Buffer,
      default: null,
    },
    youTube: {
      type: new Schema(
        {
          id: {
            type: String,
            required: true,
          },
          title: {
            type: String,
            required: true,
          },
          customUrl: {
            type: String,
            required: true,
          },
          thumbnail: {
            type: String,
            required: true,
          },
          refreshToken: {
            type: Buffer,
            required: true,
          },
        },
        {
          _id: false,
        },
      ),
      default: null,
    },
  },
  {
    timestamps: true,
    statics: {
      async build(attrs: UserAttrs) {
        return this.create(attrs);
      },
    },
    virtuals: {
      memberships: {
        options: {
          ref: 'Membership',
          localField: '_id',
          foreignField: 'user',
        },
      },
    },
  },
);

const UserCollection = model<UserDoc, UserModel>('User', userSchema, 'User');

export default UserCollection;
