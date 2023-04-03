import { Document, Model, Schema, Types, model } from 'mongoose';

export interface UserAttrs {
  _id: string; // Discord ID
  username: string;
  avatar: string;
}

export interface UserDoc extends UserAttrs, Document<string> {
  _id: string;
  memberships: Types.ObjectId[];
  language: SupportedOCRLanguage['language'];
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
    memberships: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: 'Membership',
          required: true,
        },
      ],
      required: true,
      default: [],
    },
    language: {
      type: String,
      required: true,
      default: 'English',
    },
  },
  {
    timestamps: true,
    statics: {
      async build(attrs: UserAttrs) {
        return this.create(attrs);
      },
    },
  },
);

const User = model<UserDoc, UserModel>('User', userSchema, 'User');

export default User;
