"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import Logo3d from "@/components/Logo3d";
import { useToast } from "./ToastProvider";

type Doc = {
  id: string;
  title: string;
  updatedAt: string;
  shares: { userId: string; permission: string; user: { id: string; name: string } }[];
  owner?: { id: string; name: string };
};

export default function Dashboard({ user }: { user: { id: string; name: string } }) {
  const [owned, setOwned] = useState<Doc[]>([]);
  const [shared, setShared] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/documents");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const d = await res.json();
      setOwned(d.owned ?? []);
      setShared(d.shared ?? []);
    } catch {
      setError("Could not load documents");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function createDoc() {
    const res = await fetch("/api/documents", { method: "POST" });
    if (!res.ok) {
      setError("Could not create document");
      return;
    }
    const d = await res.json();
    toast("Document created");
    router.push(`/doc/${d.document.id}`);
  }

  async function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg("");
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportMsg(d.error ?? "Import failed");
        return;
      }
      toast("File imported into a new document");
      router.push(`/doc/${d.document.id}`);
    } catch {
      setImportMsg("Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function deleteDoc(id: string) {
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast((await res.json().catch(() => ({}))).error ?? "Delete failed");
      return;
    }
    setOwned((o) => o.filter((d) => d.id !== id));
    setDeletingId(null);
    toast("Document deleted");
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function DocRow({ doc, shared: isShared, index }: { doc: Doc; shared: boolean; index: number }) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -40 }}
        transition={{ delay: index * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ y: -3 }}
      >
        <Link
          href={`/doc/${doc.id}`}
          className="flex items-center justify-between rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:border-blue-400 hover:shadow-lg"
        >
        <div>
          <div className="font-medium">{doc.title}</div>
          <div className="text-xs text-gray-500">
            Last edited {new Date(doc.updatedAt).toLocaleString()}
            {isShared && doc.owner ? ` · Shared by ${doc.owner.name}` : ""}
            {!isShared && doc.shares.length > 0
              ? ` · Shared with ${doc.shares.length} ${doc.shares.length === 1 ? "person" : "people"}`
              : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isShared && (
            <div className="relative">
              <button
                aria-label="Delete document"
                title="Delete document"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDeletingId(deletingId === doc.id ? null : doc.id);
                }}
                className="w-9 h-9 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition flex items-center justify-center"
              >
                🗑
              </button>
              {deletingId === doc.id && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="absolute right-0 top-10 z-20 bg-white border rounded-xl shadow-xl p-3 w-52"
                  onClick={(e) => e.preventDefault()}
                >
                  <p className="text-xs mb-2">Delete “{doc.title}”?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => { e.preventDefault(); deleteDoc(doc.id); }}
                      className="flex-1 rounded-lg bg-red-600 text-white text-xs py-1.5 hover:bg-red-700"
                    >
                      Delete
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); setDeletingId(null); }}
                      className="flex-1 rounded-lg border text-xs py-1.5 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          )}
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              isShared ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
            }`}
          >
            {isShared ? "Shared with me" : "Owned"}
          </span>
        </div>
      </Link>
      </motion.div>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <Logo3d />
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Signed in as {user.name}</span>
          <button
            onClick={signOut}
            className="text-sm rounded border px-3 py-1.5 hover:bg-gray-100"
          >
            Log out
          </button>
        </div>
      </header>

      {error && <p className="mb-4 rounded bg-red-50 p-3 text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-3 mb-10 mobile-stack">
        <button
          onClick={createDoc}
          className="btn-glass rounded-xl px-5 py-2.5 text-white font-medium"
        >
          + New document
        </button>
        <label
          className={`btn-glass-soft rounded-xl px-5 py-2.5 font-medium cursor-pointer ${
            importing ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          {importing ? "Importing…" : "Import .txt / .md / .docx"}
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.docx"
            className="hidden"
            onChange={importFile}
          />
        </label>
      </div>
      {importMsg && (
        <p className="mb-6 rounded bg-amber-50 p-3 text-amber-800">{importMsg}</p>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-16 w-full" />
          ))}
        </div>
      ) : (
        <>
          <section className="mb-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Owned by you
            </h2>
            <div className="space-y-2">
              {owned.length === 0 && (
                <p className="text-gray-500 text-sm">No documents yet — create one above.</p>
              )}
              <AnimatePresence>
              {owned.map((d, i) => (
                <DocRow key={d.id} doc={d} shared={false} index={i} />
              ))}
              </AnimatePresence>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Shared with you
            </h2>
            <div className="space-y-2">
              {shared.length === 0 && (
                <p className="text-gray-500 text-sm">
                  Nothing shared with you yet. Sign in as another seeded user and share a document.
                </p>
              )}
              {shared.map((d, i) => (
                <DocRow key={d.id} doc={d} shared={true} index={i} />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
