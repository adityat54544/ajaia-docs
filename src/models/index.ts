import mongoose, { Schema, models, model } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const DocumentSchema = new Schema(
  {
    title: { type: String, default: "Untitled document", trim: true, maxlength: 200 },
    // Rich-text content persisted as TipTap HTML — lossless round trip
    content: { type: String, default: "<p></p>" },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true } // createdAt / updatedAt
);

const ShareSchema = new Schema(
  {
    document: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    permission: { type: String, enum: ["view", "edit"], default: "view" },
  },
  { timestamps: true }
);
ShareSchema.index({ document: 1, user: 1 }, { unique: true });

// Attachment bytes are stored in Mongo so files sync everywhere too (limit 5 MB enforced upstream)
const AttachmentSchema = new Schema(
  {
    document: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    filename: { type: String, required: true },
    mimeType: { type: String, default: "application/octet-stream" },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

export interface UserDoc {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  isDemo: boolean;
}

export const User = models.User ?? model("User", UserSchema);
export const Document =
  models.Document ?? model("Document", DocumentSchema);
export const Share = models.Share ?? model("Share", ShareSchema);
export const Attachment =
  models.Attachment ?? model("Attachment", AttachmentSchema);
