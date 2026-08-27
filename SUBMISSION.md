# SUBMISSION — Ajaia Docs

**Live product:** https://ajaia-docs-psi-one.vercel.app
**Source code:** https://github.com/adityat54544/ajaia-docs
**Author:** Aditya Tiwari — adityat100810081008@gmail.com

## What is included

| File / folder | Purpose |
| --- | --- |
| `src/` | Full source: Next.js 15 app (pages + API routes), TipTap editor, Mongoose models |
| `README.md` | Local setup & run instructions, features, tech stack |
| `ARCHITECTURE.md` | Architecture note — priorities, tradeoffs, key flows |
| `AI_WORKFLOW.md` | AI usage note — tools, speedups, rejections, verification |
| `scripts/smoke.mjs` | 31-check end-to-end API test suite (`npm run smoke`) |
| `scripts/seed.mjs` | Seeds demo users + intro documents (`npm run seed`) |
| `src/lib/access.test.ts` | Unit tests for the role/permission matrix (`npm test`) |
| `screenshots/` | Product screenshots |
| `VIDEO_URL.txt` | Link to the 3–5 minute walkthrough video |

## Test credentials (seeded demo accounts)

All demo accounts share the password **`demo1234`**, or use the one-click demo buttons on the login page:

| Name | Email |
| --- | --- |
| Aditya (You) | aditya@ajaia.dev |
| Priya Sharma | priya@ajaia.dev |
| Marcus Chen | marcus@ajaia.dev |

You can also **sign up** with any email — no verification needed.

## Reviewing the sharing flow (2 minutes)

1. Sign in as **Aditya** → open *Welcome to Ajaia Docs* (seeded).
2. Click **Share** → add **Priya** as *Editor* and **Marcus** as *Commenter* (or any role).
3. Switch user (top right) → sign in as Priya/Marcus → the document appears under **Shared with you** with their role enforced (commenter cannot edit; viewer cannot comment).
4. Try comments, **Suggest edits**, **History** (restore), and the **.md / PDF** export buttons.

## What is working (end to end, verified by the 31-check smoke suite against production)

- Auth: email/password sign-up & sign-in, session cookies, logout, demo one-click
- Documents: create, rename, rich-text edit (bold/italic/underline/H1–H3/lists), debounced autosave, reopen
- Sharing: 5 roles (viewer → commenter → suggester → editor → owner), grant/revoke, enforced server-side
- Collaboration: live presence avatars, selection-anchored comments with resolve, suggestion mode with accept/reject review
- Version history: snapshot on every save, browse + restore
- Export: Markdown download, PDF (print view)
- Files: import .txt/.md/.docx into new docs; attachments (max 5 MB) stored in MongoDB with download
- UI: framer-motion animations, 3D glass buttons, skeleton loaders, toasts

## Intentionally cut (and why)

- **Real multiplayer cursors (Yjs + WebSocket service)** — Vercel serverless does not host persistent connections; presence indicators + autosave cover awareness. Next step if funded: separate WebSocket/PartyKit service.
- **Word-level suggestion diffs** — suggestions capture before/after document HTML per proposal; word-level diffing needs ProseMirror step maps. Next step: Yjs Awareness + relative positions.
- **Real OAuth / email verification** — the assignment allows lightweight auth; bcrypt + signed cookies demonstrate the real storage/session mechanics.
- ** attachments on S3** — in-Atlas binary storage keeps the stack free-tier and single-provider.

## What I would build next with another 2–4 hours

1. Live cursors / selections via Yjs + WebSocket (biggest UX jump)
2. Comment anchors that track text edits (relative positions)
3. Folder organization + full-text search across documents
4. Email notifications for shares/comments
5. Differential version compare view (side-by-side diff)

## Run locally

```bash
npm install
# create .env.local with MONGODB_URI + SESSION_SECRET (see README)
npm run seed
npm run dev      # http://localhost:3000
```
