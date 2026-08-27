import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "@/models";
import { connectDB } from "@/lib/mongoose";
import { SESSION_COOKIE, createToken, sessionCookieOptions } from "@/lib/auth";

const schema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(1).optional(),
  userId: z.string().optional(), // demo one-click sign-in (isDemo users only)
});

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  await connectDB();

  let user = null;
  if (parsed.data.userId) {
    // Demo one-click: only flagged demo accounts may skip the password
    user = await User.findOne({ _id: parsed.data.userId, isDemo: true });
    if (!user) return NextResponse.json({ error: "Unknown demo account" }, { status: 404 });
  } else {
    const { email, password } = parsed.data;
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
  }

  const res = NextResponse.json({
    user: { id: user._id, name: user.name, email: user.email },
  });
  res.cookies.set(SESSION_COOKIE, createToken(String(user._id)), sessionCookieOptions());
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
