import { Document, Model, Schema, Types, model } from 'mongoose';

export interface OCRMembershipAttrs {
  type: 'ocr';
  billingDate: number; // Date of month when membership is billed
  membershipRole: string; // Ref: MembershipRole
}

export interface OCRMembershipDoc extends OCRMembershipAttrs, Document<Types.ObjectId> {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface OAuthMembershipAttrs {
  type: 'oauth';
  youtubeChannel: string; // Ref: YouTubeChannel
}

export interface OAuthMembershipDoc extends OAuthMembershipAttrs, Document<Types.ObjectId> {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const baseMembershipSchema = new Schema({}, { discriminatorKey: 'type', timestamps: true });

const ocrMembershipSchema = new Schema<OCRMembershipDoc>({
  billingDate: {
    type: Number,
    required: true,
    min: 1,
    max: 31,
  },
  membershipRole: {
    type: String,
    ref: 'MembershipRole',
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
