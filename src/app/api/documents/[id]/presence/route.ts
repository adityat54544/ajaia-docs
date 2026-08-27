import { NextRequest, NextResponse } from "next/server";
import { Presence } from "@/models";
import { connectDB } from "@/lib/mongoose";
import { getCurrentUser } from "@/lib/auth";
import { loadDocWithAccess } from "@/lib/documents";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#06b6d4"];

function colorFor(userId: string) {
  let h = 0;
  for (const c of userId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

// POST /api/documents/:id/presence — heartbeat; body {name} optional (we use session user)
export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const result = await loadDocWithAccess(id, String(user._id));
  if ("error" in result) return NextResponse.json({ error: "No access" }, { status: 403 });
  await connectDB();
  const uid = String(user._id);
  const existing = await Presence.findOne({ document: id, userId: uid });
  await Presence.findOneAndUpdate(
    { document: id, userId: uid },
    { $set: { name: user.name, color: existing?.color ?? colorFor(uid), updatedAt: new Date() } },
    { upsert: true }
  );
  return list(id);
}

// GET /api/documents/:id/presence — who is currently here
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const result = await loadDocWithAccess(id, String(user._id));
  if ("error" in result) return NextResponse.json({ error: "No access" }, { status: 403 });
  return list(id);
}

async function list(documentId: string) {
  const people = await Presence.find({ document: documentId })
    .select("userId name color")
    .lean<{ userId: string; name: string; color: string }[]>();
  return NextResponse.json({
    people: people.map((p) => ({ userId: p.userId, name: p.name, color: p.color })),
  });
}
