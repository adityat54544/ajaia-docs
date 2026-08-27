"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import ShareDialog from "./ShareDialog";
import type { Role } from "@/lib/access";
import { canEditContent, canSuggest, canComment } from "@/lib/access";

type Attachment = { id: string; filename: string; size: number };
type Share = { id: string; permission: string; user: { id: string; name: string } };
type Person = { userId: string; name: string; color: string };
type CommentT = { _id: string; authorName: string; body: string; quote: string; resolved: boolean; createdAt: string };
type SuggestionT = { _id: string; authorName: string; originalHtml: string; suggestedHtml: string; status: string; createdAt: string };
type VersionT = { _id: string; title: string; savedBy: string; content: string; createdAt: string };
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
  role: Exclude<Role, null>;
  me: { id: string; name: string };
}) {
  const [title, setTitle] = useState(initialDoc.title);
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const [showShare, setShowShare] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>(initialDoc.attachments);
  const [attachMsg, setAttachMsg] = useState("");
  const [toast, setToast] = useState("");
  const attachRef = useRef<HTMLInputElement>(null);
  const canEdit = canEditContent(role);
  const titleRef = useRef(title);
  titleRef.current = title;

  // collaboration panels
  const [people, setPeople] = useState<Person[]>([]);
  const [panel, setPanel] = useState<"none" | "comments" | "suggestions" | "versions">("none");
  const [comments, setComments] = useState<CommentT[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionT[]>([]);
  const [versions, setVersions] = useState<VersionT[]>([]);
  const [commentText, setCommentText] = useState("");
  const [suggestionMode, setSuggestionMode] = useState(false);
  const lastSavedRef = useRef(initialDoc.content);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: initialDoc.content,
    editable: canEdit || canSuggest(role),
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
        if (res.ok && data.content) lastSavedRef.current = data.content;
        return res.ok;
      } catch {
        setStatus("error");
        return false;
      }
    },
    [initialDoc.id]
  );

  // Debounced autosave (skipped in suggestion mode — changes become suggestions instead)
  useEffect(() => {
    if (!editor || !canEdit || suggestionMode) return;
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
  }, [editor, canEdit, suggestionMode, save]);

  // Presence heartbeat + polling
  useEffect(() => {
    if (!editor) return;
    let alive = true;
    const beat = async () => {
      try {
        const res = await fetch(`/api/documents/${initialDoc.id}/presence`, { method: "POST" });
        if (res.ok && alive) setPeople((await res.json()).people ?? []);
      } catch { /* offline is fine */ }
    };
    beat();
    const iv = setInterval(beat, 10000);
    return () => { alive = false; clearInterval(iv); };
  }, [editor, initialDoc.id]);

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
    const res = await fetch(`/api/documents/${initialDoc.id}/upload`, { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setAttachMsg(d.error ?? "Upload failed");
    else setAttachments((a) => [...a, d.attachment]);
    if (attachRef.current) attachRef.current.value = "";
  }

  // --- panels ---
  async function openPanel(which: typeof panel) {
    const next = panel === which ? "none" : which;
    setPanel(next);
    if (next === "comments") {
      const d = await fetch(`/api/documents/${initialDoc.id}/comments`).then((r) => r.json()).catch(() => null);
      setComments(d?.comments ?? []);
    } else if (next === "suggestions") {
      const d = await fetch(`/api/documents/${initialDoc.id}/suggestions`).then((r) => r.json()).catch(() => null);
      setSuggestions(d?.suggestions ?? []);
    } else if (next === "versions") {
      const d = await fetch(`/api/documents/${initialDoc.id}/versions`).then((r) => r.json()).catch(() => null);
      setVersions(d?.versions ?? []);
    }
  }

  async function addComment() {
    if (!commentText.trim()) return;
    const quote = editor?.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " ").slice(0, 300) ?? "";
    const res = await fetch(`/api/documents/${initialDoc.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentText, quote }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(d.error ?? "Could not add comment"); return; }
    setComments((c) => [d.comment, ...c]);
    setCommentText("");
    showToast("Comment added");
  }

  async function toggleResolve(c: CommentT) {
    const res = await fetch(`/api/comments/${c._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: !c.resolved }),
    });
    if (res.ok) setComments((cs) => cs.map((x) => (x._id === c._id ? { ...x, resolved: !c.resolved } : x)));
    else showToast((await res.json().catch(() => ({}))).error ?? "Could not update");
  }

  async function submitSuggestion() {
    if (!editor) return;
    const suggested = editor.getHTML();
    const res = await fetch(`/api/documents/${initialDoc.id}/suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ originalHtml: lastSavedRef.current, suggestedHtml: suggested }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(d.error ?? "Could not submit suggestion"); return; }
    editor.commands.setContent(lastSavedRef.current);
    setSuggestionMode(false);
    showToast("Suggestion submitted for review ✓");
  }

  async function reviewSuggestion(sid: string, action: "accept" | "reject") {
    const res = await fetch(`/api/suggestions/${sid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(d.error ?? "Could not review"); return; }
    setSuggestions((s) => s.map((x) => (x._id === sid ? d.suggestion : x)));
    if (action === "accept") {
      await fetch(`/api/documents/${initialDoc.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (editor) { editor.commands.setContent(d.suggestion.suggestedHtml); lastSavedRef.current = d.suggestion.suggestedHtml; }
      showToast("Suggestion accepted ✓");
    } else showToast("Suggestion rejected");
  }

  async function restoreVersion(v: VersionT) {
    const res = await fetch(`/api/documents/${initialDoc.id}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId: v._id }),
    });
    if (!res.ok) { showToast((await res.json().catch(() => ({}))).error ?? "Restore failed"); return; }
    if (editor) { editor.commands.setContent(v.content); lastSavedRef.current = v.content; }
    showToast("Version restored ✓");
    openPanel("versions");
  }

  const btn = (active: boolean) =>
    `px-2.5 py-1.5 rounded-lg text-sm border transition-all duration-150 ${
      active ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white hover:bg-gray-100 hover:-translate-y-0.5"
    }`;
  const panelBtn = (which: typeof panel, label: string, enabled = true) => (
    <button onClick={() => enabled && openPanel(which)} disabled={!enabled} className={`${btn(panel === which)} ${enabled ? "" : "opacity-40 cursor-not-allowed"}`}>
      {label}
    </button>
  );

  if (!editor) return null;

  return (
    <main className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <Link href="/" className="text-blue-600 hover:underline text-sm">← All documents</Link>
        <div className="flex items-center gap-3">
          {/* presence avatars */}
          <div className="flex -space-x-2 items-center">
            <AnimatePresence>
              {people.map((p) => (
                <motion.div
                  key={p.userId}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  title={`${p.name} is viewing`}
                  className="w-8 h-8 rounded-full ring-2 ring-white flex items-center justify-center text-white text-xs font-bold shadow"
                  style={{ backgroundColor: p.color }}
                >
                  {p.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </motion.div>
              ))}
            </AnimatePresence>
            {people.length > 1 && (
              <span className="text-xs text-gray-500 ml-2">{people.length} viewing</span>
            )}
          </div>
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
            <button onClick={() => setShowShare(true)} className="btn-glass rounded-xl px-4 py-2 text-sm text-white font-medium">Share</button>
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
        Owned by {initialDoc.owner?.name ?? "you"} · Your role: <b>{role}</b>
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4 border-b pb-3">
        {canEdit && (
          <>
            <button onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))}><b>B</b></button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))}><i>I</i></button>
            <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive("underline"))}><u>U</u></button>
            {([1, 2, 3] as const).map((lvl) => (
              <button key={lvl} onClick={() => editor.chain().focus().toggleHeading({ level: lvl }).run()} className={btn(editor.isActive("heading", { level: lvl }))}>H{lvl}</button>
            ))}
            <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))}>• List</button>
            <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))}>1. List</button>
          </>
        )}
        {canSuggest(role) && (
          <button
            onClick={() => setSuggestionMode((v) => !v)}
            className={btn(suggestionMode)}
            title="Edits become suggestions for review instead of direct changes"
          >
            {suggestionMode ? "✓ Suggesting (on)" : "Suggest edits"}
          </button>
        )}
        {suggestionMode && (
          <button onClick={submitSuggestion} className="btn-glass rounded-lg px-3 py-1.5 text-sm text-white">Submit suggestion</button>
        )}
        <span className="flex-1" />
        {panelBtn("comments", `💬 Comments${canComment(role) ? "" : " (view)"}`, true)}
        {panelBtn("suggestions", "✎ Suggestions")}
        {panelBtn("versions", "🕘 History")}
        <a href={`/api/documents/${initialDoc.id}/export?format=md`} className={`${btn(false)}`}>↓ .md</a>
        <a href={`/api/documents/${initialDoc.id}/export?format=pdf`} target="_blank" rel="noreferrer" className={`${btn(false)}`}>↓ PDF</a>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 rounded-xl border bg-white p-6 shadow-sm">
          <EditorContent editor={editor} />
          {suggestionMode && (
            <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">
              Suggestion mode is on — your edits are captured as a proposal instead of changing the document.
            </p>
          )}
        </div>

        <AnimatePresence>
          {panel !== "none" && (
            <motion.aside
              initial={{ opacity: 0, x: 30, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 320 }}
              exit={{ opacity: 0, x: 30, width: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="w-80 shrink-0 rounded-xl border bg-white p-4 shadow-sm overflow-y-auto max-h-[75vh]"
            >
              {panel === "comments" && (
                <div>
                  <h3 className="font-semibold text-sm mb-3">Comments</h3>
                  {canComment(role) && (
                    <div className="mb-4">
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder={editor.state.selection.empty ? "Write a comment…" : `Comment on “${editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " ").slice(0, 40)}…”`}
                        className="w-full rounded-lg border p-2 text-sm outline-none focus:border-blue-400"
                        rows={2}
                      />
                      <button onClick={addComment} className="btn-glass mt-2 w-full rounded-lg py-2 text-sm text-white">Add comment</button>
                    </div>
                  )}
                  {comments.length === 0 && <p className="text-sm text-gray-400">No comments yet.</p>}
                  {comments.map((c) => (
                    <div key={c._id} className={`mb-3 rounded-lg border p-3 text-sm ${c.resolved ? "opacity-50 bg-gray-50" : "bg-white"}`}>
                      {c.quote && <p className="text-xs text-gray-400 border-l-2 border-blue-300 pl-2 mb-1">{c.quote}</p>}
                      <p className="text-xs font-semibold mb-0.5">{c.authorName}</p>
                      <p>{c.body}</p>
                      <button onClick={() => toggleResolve(c)} className="mt-1 text-xs text-blue-600 hover:underline">
                        {c.resolved ? "Unresolve" : "Resolve"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {panel === "suggestions" && (
                <div>
                  <h3 className="font-semibold text-sm mb-3">Suggestions</h3>
                  {suggestions.length === 0 && <p className="text-sm text-gray-400">No suggestions yet.</p>}
                  {suggestions.map((s) => (
                    <div key={s._id} className={`mb-3 rounded-lg border p-3 text-sm ${s.status === "pending" ? "bg-amber-50/60" : "opacity-60"}`}>
                      <p className="text-xs font-semibold mb-1">{s.authorName} · <span className={s.status === "pending" ? "text-amber-600" : "text-gray-500"}>{s.status}</span></p>
                      <details>
                        <summary className="text-xs text-gray-500 cursor-pointer">view change</summary>
                        <p className="mt-1 text-xs line-through text-red-500 break-words">{s.originalHtml.replace(/<[^>]+>/g, " ").slice(0, 200)}</p>
                        <p className="text-xs text-emerald-700 break-words">{s.suggestedHtml.replace(/<[^>]+>/g, " ").slice(0, 200)}</p>
                      </details>
                      {s.status === "pending" && canEdit && (
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => reviewSuggestion(s._id, "accept")} className="rounded-lg bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700">Accept</button>
                          <button onClick={() => reviewSuggestion(s._id, "reject")} className="rounded-lg border px-3 py-1 text-xs hover:bg-gray-100">Reject</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {panel === "versions" && (
                <div>
                  <h3 className="font-semibold text-sm mb-3">Version history</h3>
                  {versions.length === 0 && <p className="text-sm text-gray-400">No saved versions yet — edit the document first.</p>}
                  {versions.map((v) => (
                    <div key={v._id} className="mb-3 rounded-lg border p-3 text-sm">
                      <p className="text-xs font-semibold">{new Date(v.createdAt).toLocaleString()}</p>
                      <p className="text-xs text-gray-500">by {v.savedBy}</p>
                      {canEdit && (
                        <button onClick={() => restoreVersion(v)} className="mt-1 text-xs text-blue-600 hover:underline">Restore this version</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.aside>
          )}
        </AnimatePresence>
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
              <a href={`/api/documents/${initialDoc.id}/upload?attachmentId=${a.id}`} className="text-blue-600 hover:underline">{a.filename}</a>
              <span className="text-gray-400">{(a.size / 1024).toFixed(1)} KB</span>
            </li>
          ))}
          {attachments.length === 0 && <li className="text-sm text-gray-500">No attachments.</li>}
        </ul>
      </section>

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-gray-900 text-white text-sm px-5 py-2.5 shadow-xl z-50"
        >
          {toast}
        </motion.div>
      )}

      {showShare && role === "owner" && (
        <ShareDialog docId={initialDoc.id} ownerId={me.id} initialShares={initialDoc.shares} onDone={() => setShowShare(false)} />
      )}
    </main>
  );
}
