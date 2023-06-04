import { Document, Model, Schema, model } from 'mongoose';

export interface GuildAttrs {
  _id: string; // Discord Guild ID
  name: string;
  icon: string | null;
}

export interface GuildDoc extends GuildAttrs, Document<string> {
  _id: string;
  logChannel: string | null; // Discord Text Channel ID
  createdAt: Date;
  updatedAt: Date;
}

interface GuildModel extends Model<GuildDoc> {
  build: (attrs: GuildAttrs) => Promise<GuildDoc>;
}

const guildSchema = new Schema<GuildDoc>(
  {
    _id: String,
    name: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
      default: null,
    },
    logChannel: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    statics: {
      async build(attrs: GuildAttrs): Promise<GuildDoc> {
        return this.create(attrs);
      },
    },
    virtuals: {
      membershipRoles: {
        options: {
          ref: 'MembershipRole',
          localField: '_id',
          foreignField: 'guild',
        },
      },
    },
  },
);

const GuildCollection = model<GuildDoc, GuildModel>('Guild', guildSchema, 'Guild');

export default GuildCollection;
