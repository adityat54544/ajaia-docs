import { getCurrentUser } from "@/lib/auth";
import { loadDocWithAccess } from "@/lib/documents";
import { Attachment } from "@/models";
import type { Role } from "@/lib/access";
import DocEditor from "@/components/DocEditor";

export const dynamic = "force-dynamic";

export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return (
      <main className="max-w-md mx-auto mt-24 p-6">
        <h1 className="text-xl font-bold mb-4">Please sign in</h1>
        <a href="/login" className="text-blue-600 underline">
          Choose an account →
        </a>
      </main>
    );
  }

  const result = await loadDocWithAccess(id, String(user._id));
  if ("error" in result) {
    return (
      <main className="max-w-md mx-auto mt-24 p-6">
        <h1 className="text-xl font-bold mb-2">
          {result.error === "not_found" ? "Document not found" : "No access"}
        </h1>
        <p className="text-gray-600 mb-4">
          {result.error === "not_found"
            ? "This document does not exist."
            : "You do not have permission to view this document."}
        </p>
        <a href="/" className="text-blue-600 underline">
          ← Back to documents
        </a>
      </main>
    );
  }

  const attachments = await Attachment.find({ document: id })
    .select("filename size")
    .lean<{ _id: unknown; filename: string; size: number }[]>();

  return (
    <DocEditor
      doc={{
        ...result.plain,
        attachments: attachments.map((a) => ({
          id: String(a._id),
          filename: a.filename,
          size: a.size,
        })),
      }}
      role={result.role as Exclude<Role, null>}
      me={{ id: String(user._id), name: user.name }}
    />
  );
}
