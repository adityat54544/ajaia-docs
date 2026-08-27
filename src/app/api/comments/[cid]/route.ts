import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Comment } from "@/models";
import { connectDB } from "@/lib/mongoose";
import { getCurrentUser, canManage } from "@/lib/auth";
import { loadDocWithAccess } from "@/lib/documents";

type Ctx = { params: Promise<{ cid: string }> };

const schema = z.object({ resolved: z.boolean() });

// PATCH /api/comments/:cid — resolve/unresolve (owner or the comment author)
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { cid } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "resolved (boolean) required" }, { status: 400 });

  await connectDB();
  const comment = await Comment.findById(cid);
  if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  const result = await loadDocWithAccess(String(comment.document), String(user._id));
  if ("error" in result) return NextResponse.json({ error: "No access" }, { status: 403 });
  const isAuthor = String(comment.author) === String(user._id);
  if (!canManage(result.role) && !isAuthor) {
    return NextResponse.json({ error: "Only the owner or comment author can resolve" }, { status: 403 });
  }
  comment.resolved = parsed.data.resolved;
  await comment.save();
  return NextResponse.json({ comment });
}
