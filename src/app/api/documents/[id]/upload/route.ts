import { NextRequest, NextResponse } from "next/server";
import { Attachment } from "@/models";
import { connectDB } from "@/lib/mongoose";
import { getCurrentUser } from "@/lib/auth";
import { loadDocWithAccess } from "@/lib/documents";

type Ctx = { params: Promise<{ id: string }> };

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = [".txt", ".md", ".docx", ".pdf", ".png", ".jpg", ".jpeg", ".csv"];

// POST /api/documents/:id/upload — attach a file (stored in MongoDB)
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const result = await loadDocWithAccess(id, String(user._id));
  if ("error" in result) return NextResponse.json({ error: "No access" }, { status: 403 });
  if (!result.canEdit) return NextResponse.json({ error: "Read-only access" }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required" }, { status: 400 });
  }
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED.includes(ext)) {
    return NextResponse.json(
      { error: `Unsupported file type. Allowed: ${ALLOWED.join(", ")}` },
      { status: 415 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 413 });
  }

  await connectDB();
  const att = await Attachment.create({
    document: id,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    data: Buffer.from(await file.arrayBuffer()),
  });
  return NextResponse.json(
    { attachment: { id: String(att._id), filename: att.filename, size: att.size } },
    { status: 201 }
  );
}

// GET /api/documents/:id/upload?attachmentId=... — download an attachment
export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const result = await loadDocWithAccess(id, String(user._id));
  if ("error" in result) return NextResponse.json({ error: "No access" }, { status: 403 });

  const attachmentId = req.nextUrl.searchParams.get("attachmentId");
  if (!attachmentId) return NextResponse.json({ error: "attachmentId required" }, { status: 400 });
  await connectDB();
  const att = await Attachment.findOne({ _id: attachmentId, document: id });
  if (!att) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(att.data), {
    headers: {
      "Content-Type": att.mimeType,
      "Content-Disposition": `attachment; filename="${att.filename.replace(/"/g, "")}"`,
    },
  });
}
