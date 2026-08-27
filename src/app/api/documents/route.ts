import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Document, Share, User } from "@/models";
import { connectDB } from "@/lib/mongoose";
import { getCurrentUser } from "@/lib/auth";
import { plainFromDoc, sharesFor, type DocLike } from "@/lib/documents";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().optional(),
});

// GET /api/documents — list owned + shared docs for current user
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await connectDB();
  const uid = String(user._id);

  const ownedDocs = await Document.find({ owner: uid }).sort({ updatedAt: -1 }).lean<DocLike[]>();
  const ownedIds = ownedDocs.map((d) => d._id);
  const shareCounts = await Share.aggregate([
    { $match: { document: { $in: ownedIds } } },
    { $group: { _id: "$document", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(shareCounts.map((s) => [String(s._id), s.count]));
  const owned = [];
  for (const d of ownedDocs) {
    const count = countMap.get(String(d._id)) ?? 0;
    const shares = count > 0 ? await sharesFor(d._id) : [];
    owned.push({ ...plainFromDoc(d, { _id: uid, name: user.name }, shares) });
  }

  const myShares = await Share.find({ user: uid }).populate<{ document: null | { _id: unknown; title: string; content: string; owner: unknown; updatedAt: Date } }>("document");
  const ownerIds = [...new Set(myShares.map((s) => String(s.document?.owner)).filter(Boolean))];
  const owners = await User.find({ _id: { $in: ownerIds } }).select("name").lean<{ _id: unknown; name: string }[]>();
  const ownerMap = new Map(owners.map((o) => [String(o._id), o]));
  const shared: Record<string, unknown>[] = [];
for (const s of myShares) {
  if (!s.document) continue;
  const owner = ownerMap.get(String(s.document.owner)) ?? null;
  shared.push({
    ...plainFromDoc(s.document, owner, await sharesFor(s.document._id)),
    permission: s.permission,
  });
}

return NextResponse.json({ owned, shared });
}

// POST /api/documents — create a new document
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await connectDB();

  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    /* empty body is fine */
  }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid document payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const doc = await Document.create({
    title: parsed.data.title ?? "Untitled document",
    content: parsed.data.content ?? "<p></p>",
    owner: user._id,
  });
  return NextResponse.json(
    { document: { id: String(doc._id), title: doc.title, content: doc.content } },
    { status: 201 }
  );
}
