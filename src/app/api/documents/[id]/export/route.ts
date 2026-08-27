import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { loadDocWithAccess } from "@/lib/documents";

type Ctx = { params: Promise<{ id: string }> };

/** Convert the TipTap HTML subset we use into Markdown. */
function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h1>(.*?)<\/h1>/gi, "# $1\n\n")
    .replace(/<h2>(.*?)<\/h2>/gi, "## $1\n\n")
    .replace(/<h3>(.*?)<\/h3>/gi, "### $1\n\n")
    .replace(/<li>(.*?)<\/li>/gi, "- $1\n")
    .replace(/<ul>\s*/gi, "\n")
    .replace(/<\/ul>\s*/gi, "\n")
    .replace(/<ol>\s*/gi, "")
    .replace(/<\/ol>\s*/gi, "\n")
    .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em>(.*?)<\/em>/gi, "*$1*")
    .replace(/<i>(.*?)<\/i>/gi, "*$1*")
    .replace(/<u>(.*?)<\/u>/gi, "_$1_")
    .replace(/<code>(.*?)<\/code>/gi, "`$1`")
    .replace(/<p><\/p>/gi, "\n")
    .replace(/<p>(.*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// GET /api/documents/:id/export?format=md
export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const result = await loadDocWithAccess(id, String(user._id));
  if ("error" in result) return NextResponse.json({ error: "No access" }, { status: 403 });

  const format = req.nextUrl.searchParams.get("format") ?? "md";
  const safeTitle = result.plain.title.replace(/[^\w\- ]/g, "").trim() || "document";

  if (format === "md") {
    const md = `# ${result.plain.title}\n\n${htmlToMarkdown(result.plain.content)}\n`;
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeTitle}.md"`,
      },
    });
  }
  if (format === "pdf") {
    // Print-optimized HTML — the browser renders it to PDF via print dialog
    const printHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${result.plain.title}</title><style>body{font-family:Georgia,serif;max-width:760px;margin:48px auto;color:#111;line-height:1.7}h1{font-size:28pt;margin:0 0 4px}ul,ol{padding-left:1.6em}blockquote{border-left:3px solid #ccc;margin:0;padding-left:1em;color:#555}@media print{.no-print{display:none}}</style></head><body><div class="no-print" style="font-family:sans-serif;margin-bottom:24px"><button onclick="window.print()" style="padding:10px 18px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-size:14px;cursor:pointer">Save as PDF</button></div><h1>${result.plain.title}</h1>${result.plain.content}<script>document.querySelector("button").focus()</script></body></html>`;
    return new NextResponse(printHtml, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  return NextResponse.json({ error: "format must be md or pdf" }, { status: 400 });
}
