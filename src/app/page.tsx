import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <main className="max-w-md mx-auto mt-24 p-6">
        <h1 className="text-2xl font-bold mb-4">Ajaia Docs</h1>
        <p className="mb-6 text-gray-600">
          Sign in to continue — everything is stored in MongoDB Atlas, so your
          documents sync everywhere.
        </p>
        <a
          href="/login"
          className="btn-glass inline-block rounded-xl px-5 py-2.5 text-white font-medium"
        >
          Sign in →
        </a>
      </main>
    );
  }
  return <Dashboard user={{ id: String(user._id), name: user.name }} />;
}
