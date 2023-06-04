import { Document, Model, Schema, model } from 'mongoose';

export interface MembershipRoleAttrs {
  _id: string; // Discord Role ID
  name: string;
  color: number;
  guild: string; // Ref: Guild
  youTubeChannel: string; // Ref: YouTubeChannel
}

export interface MembershipRoleDoc extends MembershipRoleAttrs, Document<string> {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MembershipRoleModel extends Model<MembershipRoleDoc> {
  build: (attrs: MembershipRoleAttrs) => Promise<MembershipRoleDoc>;
}

const membershipRoleSchema = new Schema<MembershipRoleDoc>(
  {
    _id: String,
    name: {
      type: String,
      required: true,
    },
    color: {
      type: Number,
      required: true,
    },
    guild: {
      type: String,
      ref: 'Guild',
      required: true,
    },
    youTubeChannel: {
      type: String,
      ref: 'YouTubeChannel',
      required: true,
    },
  },
  {
    timestamps: true,
    statics: {
      async build(attrs: MembershipRoleAttrs): Promise<MembershipRoleDoc> {
        return this.create(attrs);
      },
    },
  },
);

const MembershipRoleCollection = model<MembershipRoleDoc, MembershipRoleModel>(
  'MembershipRole',
  membershipRoleSchema,
  'MembershipRole',
);

export default MembershipRoleCollection;
