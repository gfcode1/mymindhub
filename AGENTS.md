# AGENTS.md

BinHub is a local-first PWA for notes, todos, bookmarks, calendar and voice notes. React 19 + Vite 8 + TypeScript 6, data in IndexedDB (Dexie), no backend, no auth. UI text is Italian; code identifiers are English.

## Commands

- Install: `pnpm install`
- Dev server: `pnpm dev`
- Verify: `pnpm typecheck && pnpm lint && pnpm test`
- Build: `pnpm build` (runs `tsc -b` then `vite build`)
- One test file: `pnpm exec vitest run src/tests/db.test.ts`
- One test by name: `pnpm exec vitest run -t "creates and updates a note"`
- PWA/offline testing: `pnpm build && pnpm preview`. The service worker is disabled in dev (`devOptions: false`).
- CI uses Node 22 and pnpm 11.22.0 (see `.github/workflows/deploy-pages.yml`).

## Architecture

- Routing is intentionally **HashRouter** (`/#/notes/...`); static hosts do not need rewrites. Do not switch to BrowserRouter.
- Pages are lazy-loaded in `src/App.tsx`; shell/nav lives in `src/components/layout/AppShell.tsx`.
- Dexie DB `binhub`, schema in `src/db/db.ts`. Live queries: `src/hooks/useData.ts`. Components read data through those hooks, not `db` directly.
- `src/db/seed.ts` is also the repository layer: all CRUD helpers and soft-delete/restore functions live there, not only seeding. App boot waits for `seedIfNeeded()`; first run seeds demo data.
- `src/types/models.ts` contains both TypeScript models and Zod schemas. Change them together. Backup serialization/validation is in `src/db/backup.ts`; bump its `schemaVersion` for incompatible format changes.
- Deletes are soft (`deletedAt`). New queries must filter out deleted rows.
- Voice audio is a `Blob` in IndexedDB (`voiceNotes`) and is included in backup ZIPs.
- Settings are one row in `settings` with `key: 'app'`; use `saveSettings()` rather than writing directly.
- Zustand is only for transient UI state (`src/hooks/useUI.ts`); server-like data is Dexie live queries.
- UI primitives are custom under `src/components/ui` (not shadcn). Tailwind v4 theme tokens live in `src/index.css` (`bg-canvas`, `text-ink`, `border-line`, etc.).
- Theme changes must keep three places in sync: `src/hooks/useTheme.ts`, the inline early-theme script in `index.html`, and localStorage keys `binhub-theme` / `binhub-accent`.

## PWA and deploy

- `VITE_BASE` controls the deployment subpath. Never hardcode root-absolute app assets; use `%BASE_URL%` in HTML or `import.meta.env.BASE_URL` in TS. Manifest, icons, shortcuts and Workbox `navigateFallback` are base-aware.
- `manifestFilename: 'manifest.json'` is deliberate (Neocities serves `.webmanifest` with the wrong MIME type). Keep it.
- GitHub Pages: `https://gfcode1.github.io/mymindhub/`. Workflow: `.github/workflows/deploy-pages.yml`; Pages source must be **GitHub Actions**. `pnpm deploy:github` only creates a local commit; push manually. CI derives the base from `configure-pages`.
- Neocities: `pnpm deploy:neocities` uses `async-neocities` and forces `VITE_BASE=/`. `.env.deploy` is gitignored: never commit or print its API key. `--prune` deletes remote orphan files.
- Neocities free CSP (`worker-src blob:`) blocks service worker registration, so offline does not work there. GitHub Pages has no such CSP and supports the PWA offline flow. Do not add workarounds for Neocities CSP in app code.
- `dist/` is ignored and built by CI; do not commit it.

## Conventions and gotchas

- TypeScript uses `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals` and `noUnusedParameters`: use `import type`, avoid enums/namespaces.
- Import alias: `@/*` → `src/*`.
- Lint is `oxlint`; existing `react(set-state-in-effect)` warnings are known and non-blocking.
- Tests run in jsdom with `fake-indexeddb` (`src/tests/setup.ts`). DB tests clear tables in `beforeEach`.
- `idee.txt` is a tracked user idea list, not application code. Leave it untouched unless explicitly asked.
- Setup/deploy details are documented in `README.md`; prefer its commands over guessing.
