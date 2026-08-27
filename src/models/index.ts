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
    // legacy values "view"/"edit" are normalized in lib/access.ts
  permission: { type: String, enum: ["viewer", "commenter", "suggester", "editor", "view", "edit"], default: "viewer" },
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

// --- collaboration feature models ---

const CommentSchema = new Schema(
  {
    document: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true },
    quote: { type: String, default: "" }, // selected text the comment anchors to
    body: { type: String, required: true },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const SuggestionSchema = new Schema(
  {
    document: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true },
    originalHtml: { type: String, required: true },
    suggestedHtml: { type: String, required: true },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
  },
  { timestamps: true }
);

const VersionSchema = new Schema(
  {
    document: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    savedBy: { type: String, required: true },
  },
  { timestamps: true }
);

// Short-lived presence rows; TTL cleans them up automatically
const PresenceSchema = new Schema(
  {
    document: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    userId: { type: String, required: true },
    name: { type: String, required: true },
    color: { type: String, required: true },
    updatedAt: { type: Date, index: { expires: 75 } },
  },
  { timestamps: true }
);
PresenceSchema.index({ document: 1, userId: 1 }, { unique: true });

export const Comment = models.Comment ?? model("Comment", CommentSchema);
export const Suggestion = models.Suggestion ?? model("Suggestion", SuggestionSchema);
export const Version = models.Version ?? model("Version", VersionSchema);
export const Presence = models.Presence ?? model("Presence", PresenceSchema);
