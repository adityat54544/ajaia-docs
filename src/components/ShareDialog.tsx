"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "./ToastProvider";

type Share = { id: string; permission: string; user: { id: string; name: string } };

export default function ShareDialog({
  docId,
  ownerId,
  initialShares,
  onDone,
}: {
  docId: string;
  ownerId: string;
  initialShares: Share[];
  onDone: () => void;
}) {
  const [shares, setShares] = useState<Share[]>(initialShares);
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [userId, setUserId] = useState("");
  const [permission, setPermission] = useState<"viewer" | "commenter" | "suggester" | "editor">("editor");
  const [error, setError] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []));
  }, []);

  const candidates = users.filter(
    (u) => u.id !== ownerId && !shares.some((s) => s.user.id === u.id)
  );

  async function grant() {
    setError("");
    if (!userId) {
      setError("Pick a user to share with");
      return;
    }
    const res = await fetch(`/api/documents/${docId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, permission }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error ?? "Could not share");
      return;
    }
    setShares((s) => [...s, d.share]);
    setUserId("");
  }

  async function revoke(uid: string) {
    const res = await fetch(`/api/documents/${docId}/share?userId=${uid}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setShares((s) => s.filter((x) => x.user.id !== uid));
      toast("Access revoked");
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onDone}
    >
      <div
        className="bg-white rounded-xl p-5 sm:p-6 w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">Share document</h2>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="flex-1 rounded border px-3 py-2 text-sm"
          >
            <option value="">Choose a user…</option>
            {candidates.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
          <select
            value={permission}
            onChange={(e) => setPermission(e.target.value as "viewer" | "commenter" | "suggester" | "editor")}
            className="rounded border px-3 py-2 text-sm"
          >
            <option value="edit">Can edit</option>
            <option value="view">Can view</option>
          </select>
          <button
            onClick={grant}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700"
          >
            Share
          </button>
        </div>

        {error && <p className="mb-3 text-sm text-red-700">{error}</p>}

        <ul className="space-y-2 mb-4">
          {shares.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded border px-3 py-2 text-sm"
            >
              <span>
                {s.user.name}{" "}
                <span className="text-gray-500">· {s.permission === "edit" ? "Can edit" : "Can view"}</span>
              </span>
              <button
                onClick={() => revoke(s.user.id)}
                className="text-red-600 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
          {shares.length === 0 && (
            <li className="text-sm text-gray-500">Not shared with anyone yet.</li>
          )}
        </ul>

        <button
          onClick={onDone}
          className="w-full rounded border px-4 py-2 text-sm hover:bg-gray-100"
        >
          Done
        </button>
      </div>
    </div>
  );
}
