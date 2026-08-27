"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import ShareDialog from "./ShareDialog";

type Attachment = { id: string; filename: string; size: number };
type Share = { id: string; permission: string; user: { id: string; name: string } };
type Doc = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  owner: { id: string; name: string } | null;
  shares: Share[];
  attachments: Attachment[];
};

export default function DocEditor({
  doc: initialDoc,
  role,
  me,
}: {
  doc: Doc;
  role: "owner" | "edit" | "view";
  me: { id: string; name: string };
}) {
  const [title, setTitle] = useState(initialDoc.title);
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const [showShare, setShowShare] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>(initialDoc.attachments);
  const [attachMsg, setAttachMsg] = useState("");
  const attachRef = useRef<HTMLInputElement>(null);
  const canEdit = role !== "view";
  const titleRef = useRef(title);
  titleRef.current = title;

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: initialDoc.content,
    editable: canEdit,
  });

  const save = useCallback(
    async (data: { title?: string; content?: string }) => {
      setStatus("saving");
      try {
        const res = await fetch(`/api/documents/${initialDoc.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        setStatus(res.ok ? "saved" : "error");
      } catch {
        setStatus("error");
      }
    },
    [initialDoc.id]
  );

  // Debounced autosave on content edits
  useEffect(() => {
    if (!editor || !canEdit) return;
    let timer: ReturnType<typeof setTimeout>;
    const onUpdate = () => {
      clearTimeout(timer);
      timer = setTimeout(() => save({ content: editor.getHTML() }), 800);
    };
    editor.on("update", onUpdate);
    return () => {
      clearTimeout(timer);
      editor.off("update", onUpdate);
    };
  }, [editor, canEdit, save]);

  async function rename() {
    const t = titleRef.current.trim();
    if (!t) return;
    await save({ title: t });
  }

  async function uploadAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachMsg("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/documents/${initialDoc.id}/upload`, {
      method: "POST",
      body: fd,
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setAttachMsg(d.error ?? "Upload failed");
    } else {
      setAttachments((a) => [...a, d.attachment]);
    }
    if (attachRef.current) attachRef.current.value = "";
  }


  const btn = (active: boolean) =>
    `px-2.5 py-1.5 rounded text-sm border ${
      active ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-100"
    }`;

  if (!editor) return null;

  return (
    <main className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <Link href="/" className="text-blue-600 hover:underline text-sm">
          ← All documents
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 flex items-center gap-1.5">
            {status === "saving" ? (
              <><span className="save-pulse inline-block w-1.5 h-1.5 rounded-full bg-amber-500" /> Saving…</>
            ) : status === "error" ? (
              <><span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" /> Save failed!</>
            ) : (
              <><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" /> All changes saved</>
            )}
          </span>
          {role === "owner" && (
            <button
              onClick={() => setShowShare(true)}
              className="btn-glass rounded-xl px-4 py-2 text-sm text-white font-medium"
            >
              Share
            </button>
          )}
        </div>
      </div>

      {role === "owner" ? (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={rename}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="w-full text-3xl font-bold mb-4 bg-transparent outline-none border-b border-transparent focus:border-gray-300 pb-1"
          placeholder="Document title"
        />
      ) : (
        <h1 className="text-3xl font-bold mb-1">{title}</h1>
      )}
      <p className="text-xs text-gray-500 mb-6">
        Owned by {initialDoc.owner?.name ?? "you"}
        {role === "view" && " · Read-only (shared as view)"}
      </p>

      {canEdit && (
        <div className="flex flex-wrap gap-1 mb-4 border-b pb-3">
          <button onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))}><b>B</b></button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))}><i>I</i></button>
          <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive("underline"))}><u>U</u></button>
          {([1, 2, 3] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => editor.chain().focus().toggleHeading({ level: lvl }).run()}
              className={btn(editor.isActive("heading", { level: lvl }))}
            >
              H{lvl}
            </button>
          ))}
          <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))}>• List</button>
          <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))}>1. List</button>
        </div>
      )}

      <div className="rounded-lg border bg-white p-6">
        <EditorContent editor={editor} />
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Attachments</h2>
          {canEdit && (
            <label className="text-sm text-blue-600 hover:underline cursor-pointer">
              + Attach file (txt, md, docx, pdf, images, csv · max 5 MB)
              <input ref={attachRef} type="file" className="hidden" onChange={uploadAttachment} />
            </label>
          )}
        </div>
        {attachMsg && <p className="mb-2 text-sm text-amber-800">{attachMsg}</p>}
        <ul className="space-y-1">
          {attachments.map((a) => (
            <li key={a.id} className="text-sm flex justify-between rounded border bg-white px-3 py-2">
              <a href={`/api/documents/${initialDoc.id}/upload?attachmentId=${a.id}`} className="text-blue-600 hover:underline">
                {a.filename}
              </a>
              <span className="text-gray-400">{(a.size / 1024).toFixed(1)} KB</span>
            </li>
          ))}
          {attachments.length === 0 && <li className="text-sm text-gray-500">No attachments.</li>}
        </ul>
      </section>

      {showShare && role === "owner" && (
        <ShareDialog
          docId={initialDoc.id}
          ownerId={me.id}
          initialShares={initialDoc.shares}
          onDone={() => setShowShare(false)}
        />
      )}
    </main>
  );
}
