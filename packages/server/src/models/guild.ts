import { Document, Model, Schema, model } from 'mongoose';

export interface GuildAttrs {
  _id: string; // Discord Guild ID
  name: string;
  icon: string | null;
  allowedMembershipVerificationMethods: {
    oauth: boolean;
    ocr: boolean;
  };
}

interface GuildDoc extends GuildAttrs, Document<string> {
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
    allowedMembershipVerificationMethods: new Schema<
      GuildDoc['allowedMembershipVerificationMethods']
    >(
      {
        oauth: {
          type: Boolean,
          required: true,
        },
        ocr: {
          type: Boolean,
          required: true,
        },
      },
      {
        _id: false,
      },
    ),
  },
  {
    timestamps: true,
    statics: {
      async build(attrs: GuildAttrs) {
        return this.create(attrs);
      },
    },
  },
);

const Guild = model<GuildDoc, GuildModel>('Guild', guildSchema, 'Guild');

export default Guild;
