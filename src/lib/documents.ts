import { Document, Share, User } from "@/models";
import { connectDB } from "./mongoose";
import { resolveRole, AccessRole } from "./access";

export type PlainShare = { id: string; userId: string; permission: string; user: { id: string; name: string } };
export type PlainDoc = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  owner: { id: string; name: string } | null;
  shares: PlainShare[];
};

type DocLike = { _id: unknown; title: string; content: string; owner: unknown; updatedAt: Date; toJSON?: unknown };

export type { DocLike };

export function plainFromDoc(doc: DocLike, owner?: { _id: unknown; name: string } | null, shares: PlainShare[] = []): PlainDoc {
  return {
    id: String(doc._id),
    title: doc.title,
    content: doc.content,
    updatedAt: new Date(doc.updatedAt).toISOString(),
    owner: owner ? { id: String(owner._id), name: owner.name } : null,
    shares,
  };
}

/** Load shares (with user names) for a document id. */
export async function sharesFor(documentId: unknown): Promise<PlainShare[]> {
  const shares = await Share.find({ document: documentId })
    .populate<{ user: { _id: unknown; name: string } }>("user", "name")
    .lean<{ _id: unknown; user: { _id: unknown; name: string }; permission: string }[]>();
  return shares.map((s) => ({
    id: String(s._id),
    userId: String(s.user._id),
    permission: s.permission,
    user: { id: String(s.user._id), name: s.user.name },
  }));
}

export async function loadDocWithAccess(id: string, userId: string) {
  await connectDB();
  const doc = await Document.findById(id).lean<DocLike>();
  if (!doc) return { error: "not_found" as const };
  const shares = await sharesFor(doc._id);
  const role: AccessRole = resolveRole(
    { ownerId: String(doc.owner), shares: shares.map((s) => ({ userId: s.userId, permission: s.permission })) },
    userId
  );
  if (!role) return { error: "forbidden" as const };
  let owner: { _id: unknown; name: string } | null = null;
  if (doc.owner) {
    owner = await User.findById(doc.owner).select("name").lean<{ _id: unknown; name: string }>();
  }
  return { doc, role, plain: plainFromDoc(doc, owner, shares) };
}
