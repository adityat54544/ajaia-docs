import crypto from "crypto";
import { cookies } from "next/headers";
import { User } from "@/models";
import { connectDB } from "./mongoose";
import { resolveRole } from "./access";

export const SESSION_COOKIE = "ajaia_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

function sign(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** HMAC-signed session token: base64url(userId.exp).signature */
export function createToken(userId: string) {
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = Buffer.from(`${userId}.${exp}`).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const [userId, exp] = Buffer.from(payload, "base64url").toString().split(".");
  if (!userId || !exp || Number(exp) < Date.now()) return null;
  return userId;
}

export function sessionCookieOptions(maxAge = MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function getCurrentUser() {
  const store = await cookies();
  const userId = verifyToken(store.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  await connectDB();
  try {
    return await User.findById(userId).lean<{ _id: unknown; name: string; email: string }>();
  } catch {
    return null;
  }
}

export { resolveRole };
export type { AccessRole } from "./access";
