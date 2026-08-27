# Ajaia Docs

A lightweight collaborative document editor inspired by Google Docs. Built with **Next.js 15 + TypeScript + TipTap**, persisted in **MongoDB Atlas** so everything stays synced across devices and deployments.

> 🚀 **Live:** https://ajaia-docs-psi-one.vercel.app
> 💻 **Source:** https://github.com/adityat54544/ajaia-docs

## Demo video

Watch a walkthrough of the full workflow — auth, editing, sharing, collaboration, and export:

[▶️ Watch the Ajaia Docs demo video](https://drive.google.com/file/d/17NMfip8nu0Uz60ZSWDYsoVjE93MOKhUS/view?usp=sharing)

---

## Quick start

1. Create a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster, allow network access (`0.0.0.0/0` for serverless deploys) and a database user.
2. Create `.env.local` in the project root:

```env
MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>/ajaia-docs?retryWrites=true&w=majority"
SESSION_SECRET="any-long-random-string"
```

3. Run:

```bash
npm install
npm run seed     # demo users + intro documents
npm run dev      # http://localhost:3000
```

## Demo accounts (password: `demo1234`) or sign up free

| Name          | Email              |
| ------------- | ------------------ |
| Aditya (You)  | aditya@ajaia.dev   |
| Priya Sharma  | priya@ajaia.dev    |
| Marcus Chen   | marcus@ajaia.dev   |

Or **sign up** with any email — accounts and documents all live in MongoDB Atlas.

## Features

### Editing
- Create, rename, delete, and reopen documents
- Rich text: **bold**, *italic*, <u>underline</u>, H1–H3, bullet & numbered lists
- Debounced autosave with a live save-status indicator

### Auth
- Email/password sign-up & sign-in (bcryptjs hashing), HMAC-SHA256 signed httpOnly cookies
- Proper **Log out** (dashboard & editor)

### Files
- Import `.txt` / `.md` / `.docx` into new documents (mammoth for .docx)
- Attach files (max 5 MB) stored in MongoDB, downloadable from any device

### Sharing & collaboration
- Roles: **Viewer → Commenter → Suggester → Editor → Owner**, enforced server-side on every route
- Dashboard separates **Owned** vs **Shared with you**
- **Live presence** avatars (viewers in real time)
- **Comments** (text-anchored, resolve/unresolve) and **Suggestion mode** (accept/reject)

### Versions & export
- **Version history** (last 30) with one-click restore
- **Export** as Markdown (`.md`) or PDF (print view)

### UI & polish
- Framer Motion: page transitions, staggered lists, spring modals, toasts
- 3D animated wordmark with cursor parallax, 3D glass buttons, skeleton loaders
- Mobile-responsive; respects `prefers-reduced-motion`

## Verification

```bash
npm test                        # unit tests (role/permission matrix)
npm run build                   # type + build gate
npm run smoke -- http://localhost:3000   # 34-check end-to-end suite
```

The 34-check smoke suite runs against the database and covers every feature end to end: auth, documents, sharing roles, presence, comments, suggestions, versions, exports, files, logout, and denial paths.

## Deployment (Vercel)

```bash
vercel env add MONGODB_URI production
vercel env add SESSION_SECRET production
vercel --prod
```

The database is external (Atlas), so deployments are stateless — clone the repo, point it at the same `MONGODB_URI`, and your data persists.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for priorities & tradeoffs and [AI_WORKFLOW.md](./AI_WORKFLOW.md) for how AI was used.

## Tech stack

TypeScript, Next.js 15, React 19, Tailwind CSS 4, Framer Motion, TipTap 2, MongoDB Atlas (Mongoose), bcryptjs, mammoth, Vitest, Vercel, Node.js 24, Windows 11 (VS Code).

---

**Created by Aditya Tiwari**

- Email: [adityat100810081008@gmail.com](mailto:adityat100810081008@gmail.com)
- GitHub: [adityat54544](https://github.com/adityat54544)