import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Comment } from "@/models";
import { connectDB } from "@/lib/mongoose";
import { getCurrentUser, canComment } from "@/lib/auth";
import { loadDocWithAccess } from "@/lib/documents";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(2000),
  quote: z.string().max(500).optional(),
});

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const result = await loadDocWithAccess(id, String(user._id));
  if ("error" in result) return NextResponse.json({ error: "No access" }, { status: 403 });
  const comments = await Comment.find({ document: id }).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const result = await loadDocWithAccess(id, String(user._id));
  if ("error" in result) return NextResponse.json({ error: "No access" }, { status: 403 });
  if (!canComment(result.role)) {
    return NextResponse.json({ error: "Viewer access cannot comment" }, { status: 403 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  await connectDB();
  const comment = await Comment.create({
    document: id,
    author: user._id,
    authorName: user.name,
    body: parsed.data.body,
    quote: parsed.data.quote ?? "",
  });
  return NextResponse.json({ comment }, { status: 201 });
}
