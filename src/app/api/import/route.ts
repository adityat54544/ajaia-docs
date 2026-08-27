import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { Document } from "@/models";
import { connectDB } from "@/lib/mongoose";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const SUPPORTED = [".txt", ".md", ".docx"];

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Minimal markdown-ish converter for .md: headings, bold/italic/code, lists, paragraphs. */
function mdToHtml(md: string) {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inList: "ul" | "ol" | null = null;
  const inline = (s: string) =>
    escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
  for (const line of lines) {
    const bullet = line.match(/^\s*[-*]\s+(.*)/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (bullet || numbered) {
      const want = numbered ? "ol" : "ul";
      if (inList !== want) {
        if (inList) out.push(`</${inList}>`);
        out.push(`<${want}>`);
        inList = want;
      }
      out.push(`<li>${inline((bullet ?? numbered)![1])}</li>`);
      continue;
    }
    if (inList) {
      out.push(`</${inList}>`);
      inList = null;
    }
    const h = line.match(/^(#{1,3})\s+(.*)/);
    if (h) {
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
    } else if (line.trim() === "") {
      out.push("<p></p>");
    } else {
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  if (inList) out.push(`</${inList}>`);
  return out.join("");
}

// POST /api/import — multipart form: file (optional title)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

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
  const dot = file.name.lastIndexOf(".");
  const ext = dot === -1 ? "" : file.name.slice(dot).toLowerCase();
  if (!SUPPORTED.includes(ext)) {
    return NextResponse.json(
      { error: `Unsupported file type "${ext || file.name}". Supported: .txt, .md, .docx` },
      { status: 415 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 413 });
  }

  let html: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (ext === ".docx") {
      html = (await mammoth.convertToHtml({ buffer })).value || "<p></p>";
    } else {
      const text = buffer.toString("utf-8");
      html = ext === ".md" ? mdToHtml(text) : `<p>${escapeHtml(text).replace(/\n/g, "</p><p>")}</p>`;
    }
  } catch {
    return NextResponse.json({ error: "Could not read file contents" }, { status: 422 });
  }

  await connectDB();
  const title =
    (form.get("title") as string | null)?.trim() ||
    (dot === -1 ? file.name : file.name.slice(0, dot)) ||
    "Imported document";
  const doc = await Document.create({ title, content: html, owner: user._id });
  return NextResponse.json(
    { document: { id: String(doc._id), title: doc.title, content: doc.content } },
    { status: 201 }
  );
}
