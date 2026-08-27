"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import Logo3d from "@/components/Logo3d";

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
      router.push(`/doc/${d.document.id}`);
    } catch {
      setImportMsg("Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function signOut() {
    await fetch("/api/auth/login", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  function DocRow({ doc, shared: isShared, index }: { doc: Doc; shared: boolean; index: number }) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
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
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            isShared ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
          }`}
        >
          {isShared ? "Shared with me" : "Owned"}
        </span>
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
            Switch user
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
              {owned.map((d, i) => (
                <DocRow key={d.id} doc={d} shared={false} index={i} />
              ))}
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
