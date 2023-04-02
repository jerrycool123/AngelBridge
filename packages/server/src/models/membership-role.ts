import { Document, Model, Schema, model } from 'mongoose';

export interface MembershipRoleAttrs {
  _id: string; // Discord Role ID
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
      async build(attrs: MembershipRoleAttrs) {
        return this.create(attrs);
      },
    },
  },
);

const MembershipRole = model<MembershipRoleDoc, MembershipRoleModel>(
  'MembershipRole',
  membershipRoleSchema,
  'MembershipRole',
);

export default MembershipRole;
