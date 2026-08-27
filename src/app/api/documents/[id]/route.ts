import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Document, Attachment } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import { loadDocWithAccess } from "@/lib/documents";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const result = await loadDocWithAccess(id, String(user._id));
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error === "not_found" ? "Document not found" : "No access to this document" },
      { status: result.error === "not_found" ? 404 : 403 }
    );
  }
  const attachments = await Attachment.find({ document: id }).select("filename mimeType size").lean<{ _id: unknown; filename: string; mimeType: string; size: number }[]>();
  return NextResponse.json({
    document: { ...result.plain, attachments: attachments.map((a) => ({ id: String(a._id), filename: a.filename, mimeType: a.mimeType, size: a.size })) },
    role: result.role,
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const result = await loadDocWithAccess(id, String(user._id));
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error === "not_found" ? "Document not found" : "No access to this document" },
      { status: result.error === "not_found" ? 404 : 403 }
    );
  }
  if (result.role === "view") return NextResponse.json({ error: "Read-only access" }, { status: 403 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const doc = await Document.findByIdAndUpdate(id, parsed.data, { new: true });
  return NextResponse.json({ document: { id: String(doc!._id), title: doc!.title, content: doc!.content } });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const result = await loadDocWithAccess(id, String(user._id));
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error === "not_found" ? "Document not found" : "No access to this document" },
      { status: result.error === "not_found" ? 404 : 403 }
    );
  }
  if (result.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can delete" }, { status: 403 });
  }
  await Promise.all([
    Document.findByIdAndDelete(id),
    Attachment.deleteMany({ document: id }),
  ]);
  return NextResponse.json({ ok: true });
}
