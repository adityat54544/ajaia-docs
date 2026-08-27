import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "@/models";
import { connectDB } from "@/lib/mongoose";
import { SESSION_COOKIE, createToken, sessionCookieOptions } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  await connectDB();
  const { name, email, password } = parsed.data;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash: await bcrypt.hash(password, 10),
  });
  const res = NextResponse.json(
    { user: { id: user._id, name: user.name, email: user.email } },
    { status: 201 }
  );
  res.cookies.set(SESSION_COOKIE, createToken(String(user._id)), sessionCookieOptions());
  return res;
}
