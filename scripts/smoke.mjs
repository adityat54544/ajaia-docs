/* End-to-end smoke test against a running server. Usage: node scripts/smoke.mjs [baseUrl] */
const base = process.argv[2] || "http://localhost:3000";

function session() {
  return { headers: {} };
}
function setCookie(sess, res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const [name, value] = pair.split("=");
    sess.headers.cookie = `${name}=${value}`;
  }
}

async function users() {
  return (await (await fetch(`${base}/api/users`)).json()).users;
}

async function login(sess, email) {
  const user = (await users()).find((u) => u.email === email);
  if (!user) throw new Error(`user not found: ${email}`);
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: user.id }),
  });
  setCookie(sess, res);
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  return user;
}

let failures = 0;
function check(label, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"} - ${label}${extra ? ` (${extra})` : ""}`);
  if (!cond) failures++;
}

const a = session(); // Aditya (owner)
const p = session(); // Priya (shared editor)
const m = session(); // Marcus (no access)

const [aditya, priya, marcus] = await Promise.all([
  login(a, "aditya@ajaia.dev"),
  login(p, "priya@ajaia.dev"),
  login(m, "marcus@ajaia.dev"),
]);

// 1. Create document
let res = await fetch(`${base}/api/documents`, {
  method: "POST",
  headers: { ...a.headers, "Content-Type": "application/json" },
  body: JSON.stringify({ title: "Smoke Test Doc" }),
});
const doc = (await res.json()).document;
check("create document", res.status === 201 && doc.title === "Smoke Test Doc");

// 2. Edit content (rich text)
const html = "<h1>Plan</h1><p><strong>bold</strong> <em>italic</em> <u>underlined</u></p><ol><li>one</li><li>two</li></ol>";
res = await fetch(`${base}/api/documents/${doc.id}`, {
  method: "PATCH",
  headers: { ...a.headers, "Content-Type": "application/json" },
  body: JSON.stringify({ content: html }),
});
const patched = (await res.json()).document;
check("edit preserves formatting", patched.content === html);

// 3. Reopen (GET)
res = await fetch(`${base}/api/documents/${doc.id}`, { headers: a.headers });
const reopened = await res.json();
check("reopen document", reopened.document.content === html && reopened.role === "owner");

// 4. Rename
res = await fetch(`${base}/api/documents/${doc.id}`, {
  method: "PATCH",
  headers: { ...a.headers, "Content-Type": "application/json" },
  body: JSON.stringify({ title: "Renamed Doc" }),
});
check("rename document", (await res.json()).document.title === "Renamed Doc");

// 5. Share with Priya (edit)
res = await fetch(`${base}/api/documents/${doc.id}/share`, {
  method: "POST",
  headers: { ...a.headers, "Content-Type": "application/json" },
  body: JSON.stringify({ userId: priya.id, permission: "edit" }),
});
check("share with edit", res.status === 201);

// 6. Priya sees it in shared list and can access
res = await fetch(`${base}/api/documents`, { headers: p.headers });
const list = await res.json();
check("shared doc appears in shared list", list.shared.some((d) => d.id === doc.id));
res = await fetch(`${base}/api/documents/${doc.id}`, { headers: p.headers });
check("priya role is edit", (await res.json()).role === "edit");

// 7. Priya can edit
res = await fetch(`${base}/api/documents/${doc.id}`, {
  method: "PATCH",
  headers: { ...p.headers, "Content-Type": "application/json" },
  body: JSON.stringify({ title: "Renamed by Priya" }),
});
check("shared editor can rename", res.ok);

// 8. Marcus has no access
res = await fetch(`${base}/api/documents/${doc.id}`, { headers: m.headers });
check("no access returns 403", res.status === 403);

// 9. Unauthenticated request returns 401
res = await fetch(`${base}/api/documents`);
check("unauthenticated returns 401", res.status === 401);

// 10. Import .md file
const md = "# Heading\nSome **bold** text\n- item A\n- item B";
const fd = new FormData();
fd.append("file", new File([md], "notes.md", { type: "text/markdown" }));
res = await fetch(`${base}/api/import`, { method: "POST", headers: a.headers, body: fd });
const imp = await res.json();
check(
  "import .md creates doc with formatting",
  res.status === 201 && imp.document.content.includes("<h1>Heading</h1>") && imp.document.content.includes("<strong>bold</strong>") && imp.document.content.includes("<li>item A</li>"),
  imp.document?.content?.slice(0, 80)
);

// 11. Reject unsupported file type
const fd2 = new FormData();
fd2.append("file", new File(["x"], "virus.exe", { type: "application/octet-stream" }));
res = await fetch(`${base}/api/import`, { method: "POST", headers: a.headers, body: fd2 });
check("unsupported type rejected (415)", res.status === 415);

// 12. Attachment upload + download
const fd3 = new FormData();
fd3.append("file", new File(["hello attachment"], "hello.txt", { type: "text/plain" }));
res = await fetch(`${base}/api/documents/${doc.id}/upload`, { method: "POST", headers: a.headers, body: fd3 });
const att = await res.json();
check("attachment upload", res.status === 201);
res = await fetch(`${base}/api/documents/${doc.id}/upload?attachmentId=${att.attachment.id}`, { headers: a.headers });
check("attachment download round-trip", (await res.text()) === "hello attachment");

// 13. Viewer cannot edit
await fetch(`${base}/api/documents/${doc.id}/share`, {
  method: "POST",
  headers: { ...a.headers, "Content-Type": "application/json" },
  body: JSON.stringify({ userId: marcus.id, permission: "view" }),
});
await fetch(`${base}/api/documents/${doc.id}`, {
  method: "PATCH",
  headers: { ...m.headers, "Content-Type": "application/json" },
  body: JSON.stringify({ title: "hacked" }),
});
const after = await (await fetch(`${base}/api/documents/${doc.id}`, { headers: a.headers })).json();
check("view-only cannot edit", after.document.title === "Renamed by Priya");

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
