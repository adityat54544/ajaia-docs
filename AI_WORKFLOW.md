# AI-Native Workflow Note

## Tools used
- **Cline (agentic AI coding assistant, Claude model)** drove the entire build: scaffolding, schema design, route implementation, UI, tests, and verification. It ran the terminal commands, wrote the files, and debugged the failures below directly.

## Where AI materially sped things up
- **Full-stack scaffolding in minutes**: Prisma schema, Zod-validated route handlers, TipTap integration, and the Tailwind UI were generated in one coherent pass, consistent in naming and structure — probably a day of manual boilerplate compressed to well under an hour.
- **Instant test harness**: the Vitest setup, the access-control unit tests, and the 14-check end-to-end smoke script were produced in a single iteration and passed immediately after two small fixes.
- **Environment debugging**: when `create-next-app` refused the folder name ("Assigment 1" fails npm naming rules) and a wrong Tiptap package name 404'd, the agent diagnosed and worked around both without losing time.

## What AI got wrong and was changed or rejected
- **Wrong package name**: it initially listed `@tiptap/extension-starter-kit`, which does not exist on npm. Rejected after the 404 and replaced with the correct `@tiptap/starter-kit`.
- **Non-compiling API routes**: several route handlers used `resolveRole(doc, ...)` against queries that hadn't included the `shares` relation — caught by the Next.js type check and fixed by including `shares` in the Prisma queries.
- **Broken script generation**: two file edits silently mangled `Dashboard.tsx` (a displaced `signOut` and a markdown-lexer bug in the import converter's list-closing logic). Both were caught by reading the diff/output and corrected — the markdown converter originally could clobber the last `<li>` when closing a list.
- **Over-engineering rejected**: an initial `next.config.ts` with `serverActions` body-size limits and external-package tuning was trimmed to only what this app actually needs.

## How correctness and reliability were verified
- **Automated**: `npm test` (6 unit tests on permission resolution) plus `scripts/smoke.mjs` (14 end-to-end assertions covering create/edit/rename/reopen, share/edit/view permissions, 401/403/404/415 error paths, .md import content, and attachment upload/download round-trip).
- **Build gate**: `npm run build` (TypeScript + Next.js compile) must pass — this is what caught the Prisma-query type errors.
- **Manual UX check**: the dashboard/editor flows were exercised through the running server (HTTP-level) to confirm the save-status indicator, shared/owned separation, and error messages behave as designed.

The pattern worth keeping: AI generates, but **every** generated change goes through a compile gate and a behavioral test before being trusted — which is exactly where the bugs above were caught.
