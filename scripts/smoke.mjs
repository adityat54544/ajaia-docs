/* End-to-end smoke test against a running server. Usage: node scripts/smoke.mjs [baseUrl] */
const base = process.argv[2] || "http://localhost:3000";

function session() { return { headers: {} }; }
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
const a = session();
const p = session();
const m = session();
const [aditya, priya, marcus] = await Promise.all([
  login(a, "aditya@ajaia.dev"),
  login(p, "priya@ajaia.dev"),
  login(m, "marcus@ajaia.dev"),
]);

// 1. create + edit + reopen + rename
let res = await fetch(`${base}/api/documents`, {
  method: "POST", headers: { ...a.headers, "Content-Type": "application/json" },
  body: JSON.stringify({ title: "Smoke Test Doc" }),
});
const doc = (await res.json()).document;
check("create document", res.status === 201);
const html = "<h1>Plan</h1><p><strong>bold</strong> <em>italic</em> <u>underlined</u></p><ol><li>one</li><li>two</li></ol>";
res = await fetch(`${base}/api/documents/${doc.id}`, {
  method: "PATCH", headers: { ...a.headers, "Content-Type": "application/json" }, body: JSON.stringify({ content: html }),
});
check("edit preserves formatting", (await res.json()).document.content === html);
res = await fetch(`${base}/api/documents/${doc.id}`, { headers: a.headers });
const reopened = await res.json();
check("reopen document", reopened.document.content === html && reopened.role === "owner");
res = await fetch(`${base}/api/documents/${doc.id}`, {
  method: "PATCH", headers: { ...a.headers, "Content-Type": "application/json" }, body: JSON.stringify({ title: "Renamed Doc" }),
});
check("rename document", (await res.json()).document.title === "Renamed Doc");

// 2. sharing roles
async function share(userId, permission) {
  return fetch(`${base}/api/documents/${doc.id}/share`, {
    method: "POST", headers: { ...a.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ userId, permission }),
  });
}
check("share priya as editor", (await share(priya.id, "editor")).status === 201);
check("share marcus as commenter", (await share(marcus.id, "commenter")).status === 201);
res = await fetch(`${base}/api/documents`, { headers: p.headers });
check("shared doc in shared list", (await res.json()).shared.some((d) => d.id === doc.id));
res = await fetch(`${base}/api/documents/${doc.id}`, { headers: p.headers });
check("priya role is editor", (await res.json()).role === "editor");

// 3. presence
await fetch(`${base}/api/documents/${doc.id}/presence`, { method: "POST", headers: p.headers });
res = await fetch(`${base}/api/documents/${doc.id}/presence`, { method: "POST", headers: a.headers });
const presence = await res.json();
check("presence shows viewers", presence.people.some((x) => x.name === priya.name) && presence.people.some((x) => x.name === aditya.name));

// 4. comments
res = await fetch(`${base}/api/documents/${doc.id}/comments`, {
  method: "POST", headers: { ...p.headers, "Content-Type": "application/json" },
  body: JSON.stringify({ body: "What about the timeline?", quote: "Plan" }),
});
check("editor can comment", res.status === 201);
const comment = (await res.json()).comment;
res = await fetch(`${base}/api/documents/${doc.id}/comments`, {
  method: "POST", headers: { ...m.headers, "Content-Type": "application/json" },
  body: JSON.stringify({ body: "Looks good overall" }),
});
check("commenter can comment", res.status === 201);
res = await fetch(`${base}/api/comments/${comment._id}`, {
  method: "PATCH", headers: { ...a.headers, "Content-Type": "application/json" }, body: JSON.stringify({ resolved: true }),
});
check("owner resolves comment", res.ok && (await res.json()).comment.resolved === true);

// 5. role enforcement
res = await fetch(`${base}/api/documents/${doc.id}`, {
  method: "PATCH", headers: { ...m.headers, "Content-Type": "application/json" }, body: JSON.stringify({ content: "<p>hacked</p>" }),
});
check("commenter cannot edit content (403)", res.status === 403);

// 6. versions: content was saved twice (create edit + ) — check history + restore
res = await fetch(`${base}/api/documents/${doc.id}/versions`, { headers: a.headers });
const versions = (await res.json()).versions;
check("version history has snapshots", versions.length >= 1);
res = await fetch(`${base}/api/documents/${doc.id}`, {
  method: "PATCH", headers: { ...p.headers, "Content-Type": "application/json" },
  body: JSON.stringify({ content: "<p>editor overwrote everything</p>" }),
});
check("editor can edit content", res.ok);
res = await fetch(`${base}/api/documents/${doc.id}/versions`, {
  method: "POST", headers: { ...p.headers, "Content-Type": "application/json" },
  body: JSON.stringify({ versionId: versions[0]._id }),
});
const restored = await res.json();
check("editor restores old version", res.ok && restored.content === html);

// 7. suggestions
await share(priya.id, "suggester");
res = await fetch(`${base}/api/documents/${doc.id}`, {
  method: "PATCH", headers: { ...p.headers, "Content-Type": "application/json" }, body: JSON.stringify({ content: "<p>direct edit attempt</p>" }),
});
check("suggester cannot edit directly (403)", res.status === 403);
const suggested = "<h1>Plan</h1><p><strong>bold</strong> text with a <em>suggested change</em></p>";
res = await fetch(`${base}/api/documents/${doc.id}/suggestions`, {
  method: "POST", headers: { ...p.headers, "Content-Type": "application/json" },
  body: JSON.stringify({ originalHtml: html, suggestedHtml: suggested }),
});
check("suggester can propose suggestion", res.status === 201);
const suggestion = (await res.json()).suggestion;
res = await fetch(`${base}/api/documents/${doc.id}/suggestions`, { headers: m.headers });
check("commenter can view suggestions", res.ok && (await res.json()).suggestions.length >= 1);
res = await fetch(`${base}/api/suggestions/${suggestion._id}`, {
  method: "PATCH", headers: { ...m.headers, "Content-Type": "application/json" }, body: JSON.stringify({ action: "accept" }),
});
check("commenter cannot accept suggestion (403)", res.status === 403);
res = await fetch(`${base}/api/suggestions/${suggestion._id}`, {
  method: "PATCH", headers: { ...a.headers, "Content-Type": "application/json" }, body: JSON.stringify({ action: "accept" }),
});
check("owner accepts suggestion", res.ok && (await res.json()).suggestion.status === "accepted");
res = await fetch(`${base}/api/documents/${doc.id}`, { headers: a.headers });
check("accepted suggestion applied to content", (await res.json()).document.content === suggested);

// 8. viewer cannot comment
await share(marcus.id, "viewer");
res = await fetch(`${base}/api/documents/${doc.id}/comments`, {
  method: "POST", headers: { ...m.headers, "Content-Type": "application/json" }, body: JSON.stringify({ body: "hi" }),
});
check("viewer cannot comment (403)", res.status === 403);

// 9. exports
res = await fetch(`${base}/api/documents/${doc.id}/export?format=md`, { headers: a.headers });
const md = await res.text();
check(
  "markdown export",
  res.ok && md.includes("# Renamed Doc") && (md.includes("**bold**") || md.includes("_underlined_")),
  md.slice(0, 60)
);
res = await fetch(`${base}/api/documents/${doc.id}/export?format=pdf`, { headers: a.headers });
check("pdf (print) export", res.ok && (res.headers.get("content-type") ?? "").includes("text/html"));

// 10. auth guards
res = await fetch(`${base}/api/documents`);
check("unauthenticated returns 401", res.status === 401);
res = await fetch(`${base}/api/documents/${doc.id}`, { headers: session().headers });
check("no-session doc access returns 401", res.status === 401);

// 11. attachment round-trip
const fd = new FormData();
fd.append("file", new File(["attachment-bytes"], "note.txt", { type: "text/plain" }));
res = await fetch(`${base}/api/documents/${doc.id}/upload`, { method: "POST", headers: a.headers, body: fd });
const att = await res.json();
check("attachment upload", res.status === 201);
res = await fetch(`${base}/api/documents/${doc.id}/upload?attachmentId=${att.attachment.id}`, { headers: a.headers });
check("attachment download", (await res.text()) === "attachment-bytes");

// 12. import
const fd2 = new FormData();
fd2.append("file", new File(["# Heading\nSome **bold** text\n- item A"], "notes.md", { type: "text/markdown" }));
res = await fetch(`${base}/api/import`, { method: "POST", headers: a.headers, body: fd2 });
const imp = await res.json();
check("import .md", res.status === 201 && imp.document.content.includes("<h1>Heading</h1>"));
const fd3 = new FormData();
fd3.append("file", new File(["x"], "virus.exe", { type: "application/octet-stream" }));
res = await fetch(`${base}/api/import`, { method: "POST", headers: a.headers, body: fd3 });
check("unsupported type rejected (415)", res.status === 415);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
