"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import Logo3d from "@/components/Logo3d";

type User = { id: string; name: string; email: string };

export default function LoginPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []))
      .catch(() => setError("Could not load demo accounts. Is the database reachable?"));
  }, []);

  async function signIn(body: Record<string, string>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? "Sign-in failed");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 auth-glow">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="glass-card w-full max-w-md p-8"
      >
        <Logo3d size="lg" />
        <h1 className="text-2xl font-bold mt-5 mb-1">Welcome back</h1>
        <p className="text-gray-500 text-sm mb-6">Sign in to Ajaia Docs</p>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-700"
          >
            {error}
          </motion.p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            signIn({ email, password });
          }}
          className="space-y-3"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border bg-white/70 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
          />
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-xl border bg-white/70 px-4 py-3 pr-16 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-800"
            >
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
          <button type="submit" disabled={busy} className="btn-glass w-full rounded-xl py-3 text-white font-medium disabled:opacity-60">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-sm text-gray-500 mt-4 text-center">
          New here? <Link href="/signup" className="text-blue-600 hover:underline">Create an account</Link>
        </p>

        <div className="mt-6 pt-5 border-t">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Or try a demo account (password: demo1234)</p>
          <div className="space-y-2">
            {users.map((u, i) => (
              <motion.button
                key={u.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.07 }}
                onClick={() => signIn({ userId: u.id })}
                disabled={busy}
                className="w-full rounded-xl border bg-white/60 px-4 py-2.5 text-left text-sm hover:border-blue-400 hover:bg-blue-50/60 transition disabled:opacity-60"
              >
                <span className="font-medium">{u.name}</span>
                <span className="text-gray-400"> · {u.email}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>
    </main>
  );
}
