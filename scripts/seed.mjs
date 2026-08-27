// Seed MongoDB with demo users + intro documents.
// Usage: npm run seed   (reads .env.local)
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// load .env.local
const envPath = path.resolve(".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Z_]+)="?([^"\n]+)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI missing — add it to .env.local");
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI, { dbName: "ajaia-docs" });

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  passwordHash: String,
  isDemo: { type: Boolean, default: false },
}, { timestamps: true });
const docSchema = new mongoose.Schema({
  title: String,
  content: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
}, { timestamps: true });
const shareSchema = new mongoose.Schema({
  document: { type: mongoose.Schema.Types.ObjectId, ref: "Document", index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  permission: { type: String, enum: ["view", "edit"], default: "view" },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Document = mongoose.models.Document || mongoose.model("Document", docSchema);
const Share = mongoose.models.Share || mongoose.model("Share", shareSchema);

const hash = await bcrypt.hash("demo1234", 10);
const demo = [
  { name: "Aditya (You)", email: "aditya@ajaia.dev" },
  { name: "Priya Sharma", email: "priya@ajaia.dev" },
  { name: "Marcus Chen", email: "marcus@ajaia.dev" },
];
const users = {};
for (const d of demo) {
  users[d.email] = await User.findOneAndUpdate(
    { email: d.email },
    { $set: { ...d, passwordHash: hash, isDemo: true } },
    { upsert: true, new: true }
  );
}
console.log("Seeded users:", demo.map((d) => d.email).join(", "), "(password: demo1234)");

// Intro documents for the primary demo user
const welcome = await Document.findOne({ title: "Welcome to Ajaia Docs" });
if (!welcome) {
  const d = await Document.create({
    title: "Welcome to Ajaia Docs",
    owner: users["aditya@ajaia.dev"]._id,
    content: [
      "<h1>Welcome to Ajaia Docs 👋</h1>",
      "<p>This is a <strong>lightweight collaborative document editor</strong> — think of it as a tiny Google Docs.</p>",
      "<h2>Try it out</h2>",
      "<ul><li>Use the toolbar above for <strong>bold</strong>, <em>italic</em>, <u>underline</u>, headings and lists</li><li>Everything <u>autosaves</u> to MongoDB Atlas — refresh and it is still here</li><li>Click <strong>Share</strong> to give Priya or Marcus access (edit or view-only)</li><li>Import a .txt, .md or .docx file from the dashboard</li></ul>",
      "<h3>How sharing works</h3>",
      "<p>Sign out, sign in as another demo account, and the shared document appears under <em>Shared with you</em>. Owners can revoke access at any time.</p>",
    ].join(""),
  });
  const notes = await Document.create({
    title: "Team Meeting Notes",
    owner: users["priya@ajaia.dev"]._id,
    content: "<h1>Sprint 4 — Sync</h1><ol><li>Shipped the rich-text editor</li><li>Reviewed autosave reliability</li><li><strong>Next:</strong> real-time cursors (Yjs spike)</li></ol><p>Shared with you so you can see the <strong>Shared with you</strong> section in action.</p>",
  });
  await Share.create({ document: notes._id, user: users["aditya@ajaia.dev"]._id, permission: "edit" });
  console.log("Seeded documents: Welcome to Ajaia Docs (owned), Team Meeting Notes (shared with you, can edit)");
} else {
  console.log("Seed documents already exist — skipped.");
}

await mongoose.disconnect();
console.log("Done.");
