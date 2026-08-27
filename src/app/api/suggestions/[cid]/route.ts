import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Suggestion, Document, Version } from "@/models";
import { connectDB } from "@/lib/mongoose";
import { getCurrentUser, canEditContent } from "@/lib/auth";
import { loadDocWithAccess } from "@/lib/documents";

type Ctx = { params: Promise<{ cid: string }> };

const schema = z.object({ action: z.enum(["accept", "reject"]) });

// PATCH /api/suggestions/:cid — accept/reject (editor and above)
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
  if (!parsed.success) return NextResponse.json({ error: "action (accept|reject) required" }, { status: 400 });

  await connectDB();
  const suggestion = await Suggestion.findById(cid);
  if (!suggestion) return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  const result = await loadDocWithAccess(String(suggestion.document), String(user._id));
  if ("error" in result) return NextResponse.json({ error: "No access" }, { status: 403 });
  if (!canEditContent(result.role)) {
    return NextResponse.json({ error: "Only editors and owners can review suggestions" }, { status: 403 });
  }

  suggestion.status = parsed.data.action === "accept" ? "accepted" : "rejected";
  await suggestion.save();

  if (parsed.data.action === "accept") {
    const doc = await Document.findByIdAndUpdate(
      suggestion.document,
      { content: suggestion.suggestedHtml },
      { new: true }
    );
    await Version.create({
      document: suggestion.document,
      title: doc!.title,
      content: suggestion.suggestedHtml,
      savedBy: `${user.name} (accepted suggestion by ${suggestion.authorName})`,
    });
  }
  return NextResponse.json({ suggestion });
}
