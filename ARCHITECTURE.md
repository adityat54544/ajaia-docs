# Architecture Note

## What I prioritized and why

**1. Working vertical slices over breadth.** The highest-value loop — create → edit with real formatting → reopen — was built first and verified end-to-end (14-check smoke script in `scripts/smoke.mjs`). Everything else (sharing, imports, attachments) layered on top of that verified core.

**2. Server-side permission enforcement in every route.** Sharing is only as good as its enforcement. A single pure function (`src/lib/access.ts` — `resolveRole`) answers "what can this user do with this document", is used by every document API route, and is unit-tested. The UI reflects permissions (read-only editor, hidden Share button), but the UI is treated as untrusted.

**3. Lossless content storage.** Document content is stored as the TipTap editor's HTML output rather than plain text or a bespoke format. This guarantees that bold/italic/headings/lists round-trip exactly, and keeps imports simple (docx via mammoth and the mini-markdown converter both emit the same HTML dialect the editor consumes).

**4. Boring, hackable infrastructure.** SQLite + Prisma + Next.js API routes: zero external services, clone-and-run setup, and a one-line datasource swap to Postgres when scale demands it. Deliberately skipped for this scope: real-time multi-user cursors (needs WebSockets/CRDTs — Yjs would be the natural next step), real authentication (seeded mock auth via a signed-value cookie is enough to demonstrate the sharing logic), and file storage on S3 (local `uploads/` dir with DB metadata records).

## Key flows

- **Autosave**: TipTap `update` event → 800 ms debounce → `PATCH /api/documents/[id]`; status indicator shows saving/saved/error.
- **Sharing**: `POST /api/documents/[id]/share` (owner-only) upserts a `Share` row with `view|edit`; revocation is `DELETE` with the user id. Ownership vs. shared is a single query distinction on the dashboard.
- **Import**: `POST /api/import` validates extension + size (5 MB), converts to HTML, creates a document owned by the current user.
- **Attachments**: file bytes go to `uploads/`, metadata to the `Attachment` table; downloads stream back through the API only after an access check.

## Project structure

```
prisma/            schema (User/Document/Share/Attachment) + seed
src/app/api/       REST route handlers (auth, documents, share, upload, import, users)
src/app/           pages: dashboard (/), login, editor (/doc/[id])
src/components/    Dashboard, DocEditor (TipTap), ShareDialog
src/lib/           db client, session helper, access-control logic (+ tests)
scripts/smoke.mjs  end-to-end API smoke test
```
