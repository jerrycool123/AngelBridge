import { Document, Model, Schema, Types, model } from 'mongoose';

export interface BaseMembershipAttrs {
  user: string; // Ref: User
  membershipRole: string; // Ref: MembershipRole
}
export interface OCRMembershipAttrs extends BaseMembershipAttrs {
  type: 'ocr';
  billingDate: Date;
}

export interface OCRMembershipDoc extends OCRMembershipAttrs, Document<Types.ObjectId> {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface OAuthMembershipAttrs extends BaseMembershipAttrs {
  type: 'oauth';
  youtubeChannel: string; // Ref: YouTubeChannel
}

export interface OAuthMembershipDoc extends OAuthMembershipAttrs, Document<Types.ObjectId> {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const baseMembershipSchema = new Schema(
  {
    user: {
      type: String,
      ref: 'User',
      required: true,
    },
    membershipRole: {
      type: String,
      ref: 'MembershipRole',
      required: true,
    },
  },
  { discriminatorKey: 'type', timestamps: true },
);

const ocrMembershipSchema = new Schema<OCRMembershipDoc>({
  billingDate: {
    type: Date,
    required: true,
  },
});
ocrMembershipSchema.add(baseMembershipSchema);

const oauthMembershipSchema = new Schema<OAuthMembershipDoc>({
  youtubeChannel: {
    type: String,
    ref: 'YouTubeChannel',
    required: true,
  },
});
oauthMembershipSchema.add(baseMembershipSchema);

type MembershipAttrs = OCRMembershipAttrs | OAuthMembershipAttrs;
export type MembershipDoc = OCRMembershipDoc | OAuthMembershipDoc;

interface MembershipModel extends Model<MembershipDoc> {
  build: (attrs: MembershipAttrs) => Promise<MembershipDoc>;
}

baseMembershipSchema.statics.build = async function (attrs: MembershipAttrs) {
  return await Membership.create(attrs);
};

const Membership = model<MembershipDoc, MembershipModel>(
  'Membership',
  baseMembershipSchema,
  'Membership',
);

Membership.discriminator('ocr', ocrMembershipSchema);
Membership.discriminator('oauth', oauthMembershipSchema);

export default Membership;
