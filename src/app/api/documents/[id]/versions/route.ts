import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Version, Document } from "@/models";
import { connectDB } from "@/lib/mongoose";
import { getCurrentUser, canEditContent } from "@/lib/auth";
import { loadDocWithAccess } from "@/lib/documents";

type Ctx = { params: Promise<{ id: string }> };
const restoreSchema = z.object({ versionId: z.string().min(1) });

// GET /api/documents/:id/versions — list snapshots
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const result = await loadDocWithAccess(id, String(user._id));
  if ("error" in result) return NextResponse.json({ error: "No access" }, { status: 403 });
  const versions = await Version.find({ document: id })
    .select("title savedBy content createdAt")
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();
  return NextResponse.json({ versions });
}

// POST /api/documents/:id/versions — restore a version (editor and above)
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const result = await loadDocWithAccess(id, String(user._id));
  if ("error" in result) return NextResponse.json({ error: "No access" }, { status: 403 });
  if (!canEditContent(result.role)) {
    return NextResponse.json({ error: "Read-only access" }, { status: 403 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = restoreSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "versionId required" }, { status: 400 });

  await connectDB();
  const version = await Version.findOne({ _id: parsed.data.versionId, document: id });
  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });
  await Document.findByIdAndUpdate(id, { content: version.content });
  await Version.create({
    document: id,
    title: version.title,
    content: version.content,
    savedBy: `${user.name} (restored)`,
  });
  return NextResponse.json({ ok: true, content: version.content });
}
