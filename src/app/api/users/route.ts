import { NextResponse } from "next/server";
import { User } from "@/models";
import { connectDB } from "@/lib/mongoose";

export async function GET() {
  await connectDB();
  const users = await User.find()
    .select("name email")
    .sort({ name: 1 })
    .lean<{ _id: unknown; name: string; email: string }[]>();
  return NextResponse.json({
    users: users.map((u) => ({ id: String(u._id), name: u.name, email: u.email })),
  });
}
