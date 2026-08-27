import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Suggestion } from "@/models";
import { connectDB } from "@/lib/mongoose";
import { getCurrentUser, canSuggest } from "@/lib/auth";
import { loadDocWithAccess } from "@/lib/documents";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  originalHtml: z.string().min(1),
  suggestedHtml: z.string().min(1),
});

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const result = await loadDocWithAccess(id, String(user._id));
  if ("error" in result) return NextResponse.json({ error: "No access" }, { status: 403 });
  const suggestions = await Suggestion.find({ document: id }).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ suggestions });
}

// POST — propose a suggestion (suggester role and above)
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const result = await loadDocWithAccess(id, String(user._id));
  if ("error" in result) return NextResponse.json({ error: "No access" }, { status: 403 });
  if (!canSuggest(result.role)) {
    return NextResponse.json({ error: "Your role cannot suggest edits" }, { status: 403 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "originalHtml and suggestedHtml are required" }, { status: 400 });
  if (parsed.data.originalHtml === parsed.data.suggestedHtml) {
    return NextResponse.json({ error: "No changes to suggest" }, { status: 400 });
  }
  await connectDB();
  const suggestion = await Suggestion.create({
    document: id,
    author: user._id,
    authorName: user.name,
    originalHtml: parsed.data.originalHtml,
    suggestedHtml: parsed.data.suggestedHtml,
  });
  return NextResponse.json({ suggestion }, { status: 201 });
}
