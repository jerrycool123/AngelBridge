import { Document, Model, Schema, model } from 'mongoose';

export interface YouTubeChannelAttrs {
  _id: string; // YouTube Channel ID
  title: string;
  description: string;
  customUrl: string;
  thumbnail: string;
  memberOnlyVideoIds: string[];
}

export interface YouTubeChannelDoc extends YouTubeChannelAttrs, Document<string> {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
}

interface YouTubeChannelModel extends Model<YouTubeChannelDoc> {
  build: (attrs: YouTubeChannelAttrs) => Promise<YouTubeChannelDoc>;
}

const youTubeChannelSchema = new Schema<YouTubeChannelDoc>(
  {
    _id: String,
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: function allowEmptyString(this: YouTubeChannelDoc): boolean {
        return typeof this.description !== 'string';
      },
    },
    customUrl: {
      type: String,
      required: true,
    },
    thumbnail: {
      type: String,
      required: true,
    },
    memberOnlyVideoIds: {
      type: [String],
      required: true,
    },
  },
  {
    timestamps: true,
    statics: {
      async build(attrs: YouTubeChannelAttrs): Promise<YouTubeChannelDoc> {
        return this.create(attrs);
      },
    },
  },
);

const YouTubeChannelCollection = model<YouTubeChannelDoc, YouTubeChannelModel>(
  'YouTubeChannel',
  youTubeChannelSchema,
  'YouTubeChannel',
);

export default YouTubeChannelCollection;
