# Ajaia Docs

A lightweight collaborative document editor inspired by Google Docs. Built with **Next.js 15 + TypeScript + TipTap**, persisted in **MongoDB Atlas** so everything stays synced everywhere.

## Quick start

1. Create a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster, allow network access (`0.0.0.0/0` for serverless deploys) and a database user.
2. Create `.env.local` in the project root:

```env
MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>/ajaia-docs?retryWrites=true&w=majority"
SESSION_SECRET="any-long-random-string"
```

3. Run it:

```bash
npm install
npm run seed     # demo users + intro documents
npm run dev      # http://localhost:3000
```

## Demo accounts (password: `demo1234`)

| Name          | Email              |
| ------------- | ------------------ |
| Aditya (You)  | aditya@ajaia.dev   |
| Priya Sharma  | priya@ajaia.dev    |
| Marcus Chen   | marcus@ajaia.dev   |

Or **sign up** with your own email — accounts and documents all live in Atlas.

## Features

- **Auth** — email/password sign-up & sign-in (bcrypt), HMAC-signed httpOnly session cookie, one-click demo accounts, logout
- **Rich-text editing** — bold, italic, underline, H1-H3, bullet & numbered lists via TipTap; debounced autosave with live save indicator
- **Sharing** — owners grant edit or view-only access to any user, revoke anytime; dashboard clearly separates *Owned* vs *Shared with me*; enforced server-side on every route
- **File handling** — import `.txt` / `.md` / `.docx` into new documents; attach files (max 5 MB) stored in MongoDB and downloadable from any device
- **Persistence** — everything in MongoDB Atlas: users, documents, shares, attachment bytes
- **UI** — framer-motion transitions, skeleton loaders, toasts, 3D glass buttons

## Verification

```bash
npm test                      # unit tests (access-control logic)
npm run build                 # type + build gate
npm start &                   # then:
npm run smoke -- http://localhost:3000   # 14-check end-to-end API test
```

## Deployment (Vercel)

```bash
npm i -g vercel
vercel            # link the project
vercel env add MONGODB_URI production
vercel env add SESSION_SECRET production
vercel --prod
```

The database is external (Atlas), so the deployment is stateless — clone the repo, point it at the same `MONGODB_URI`, and your data is there.

See [ARCHITECTURE.md](./ARCHITECTURE.md) and [AI_WORKFLOW.md](./AI_WORKFLOW.md).

## Tech stack

| Layer | Technology |
| --- | --- |
| Language | TypeScript (full stack) + JavaScript (scripts) |
| Framework | Next.js 15 (App Router) � frontend & API in one deployable app |
| UI | React 19, Tailwind CSS 4, Framer Motion (animations, 3D glass UI) |
| Rich text | TipTap 2 (ProseMirror) |
| Database | MongoDB Atlas via Mongoose ODM |
| Auth | bcryptjs password hashing + HMAC-SHA256 signed session cookies |
| File handling | mammoth (.docx import), in-Atlas attachment storage |
| Testing | Vitest + Testing Library (unit), custom end-to-end smoke suite (31 checks) |
| Hosting | Vercel (app) + MongoDB Atlas (data) |
| Tooling | Node.js 24, npm, Git/GitHub, Vercel CLI |
| Platform | Built and deployed from Windows 11 (PowerShell + VS Code) |

---

**Created by Aditya Tiwari**

- Email: [adityat100810081008@gmail.com](mailto:adityat100810081008@gmail.com)
- GitHub: [adityat54544](https://github.com/adityat54544)
