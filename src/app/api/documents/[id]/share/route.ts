import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Share, User, Document } from "@/models";
import { connectDB } from "@/lib/mongoose";
import { getCurrentUser } from "@/lib/auth";
import { loadDocWithAccess, sharesFor } from "@/lib/documents";

type Ctx = { params: Promise<{ id: string }> };

const shareSchema = z.object({
  userId: z.string().min(1),
  permission: z.enum(["view", "edit"]),
});

// GET /api/documents/:id/share — list who has access
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const result = await loadDocWithAccess(id, String(user._id));
  if ("error" in result) return NextResponse.json({ error: "No access" }, { status: 403 });
  return NextResponse.json({ shares: result.plain.shares });
}

// POST /api/documents/:id/share — grant access (owner only)
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const result = await loadDocWithAccess(id, String(user._id));
  if ("error" in result) return NextResponse.json({ error: "No access" }, { status: 403 });
  if (result.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can share" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = shareSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "userId and permission (view|edit) are required", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  await connectDB();
  const { userId, permission } = parsed.data;
  if (userId === String(user._id)) {
    return NextResponse.json({ error: "You already own this document" }, { status: 400 });
  }
  const target = await User.findById(userId);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!(await Document.findById(id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const share = await Share.findOneAndUpdate(
    { document: id, user: userId },
    { permission },
    { upsert: true, new: true }
  );
  const shares = await sharesFor(id);
  const mine = shares.find((s) => s.userId === userId);
  return NextResponse.json({ share: { ...mine, id: String(share._id) } }, { status: 201 });
}

// DELETE /api/documents/:id/share?userId=... — revoke access (owner only)
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const result = await loadDocWithAccess(id, String(user._id));
  if ("error" in result) return NextResponse.json({ error: "No access" }, { status: 403 });
  if (result.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can revoke access" }, { status: 403 });
  }
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId query param required" }, { status: 400 });
  await Share.deleteOne({ document: id, user: userId });
  return NextResponse.json({ ok: true });
}
