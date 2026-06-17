# AGENTS.md

## Cursor Cloud specific instructions

### What this project is
JB7 UAE Auto Workshop is an offline-first desktop/web app with **no remote backend or external service** and **no secrets/auth**. Stack: Vite + React 19 + TypeScript, with an Electron wrapper for desktop packaging.

### Persistence (two backends)
The renderer treats the whole `WorkshopData` object as one document and detects its environment at runtime:
- **Desktop (Electron):** a local **SQLite** database file at `<userData>/jb7-uae-workshop.sqlite`, accessed via `window.desktopDB` (preload IPC). SQLite logic lives in `electron/sqliteStore.cjs` (shared with tests) and is loaded/flushed by `electron/db.cjs`. The engine is **sql.js (WASM)** — chosen over native modules like `better-sqlite3` so the app cross-builds for Windows from Linux with no native compilation.
- **Browser (Vite dev):** falls back to `localStorage` key `jb7-uae-workshop-offline-v1`.
- The renderer hydrates from the desktop DB before its first save (`hydrated` guard in `src/App.tsx`); do not remove that guard or startup will overwrite the DB with seed data.

### Services and commands
There is a single service (the Vite app). Standard commands are defined in `package.json` scripts and `README.md`; use those rather than duplicating here:
- Dev server: `npm run dev` — Vite serves on `0.0.0.0:5173`. Open `http://127.0.0.1:5173/` to use the app in a browser.
- Tests: `npm test` (vitest, unit tests under `src/domain`).
- Lint/typecheck + build: `npm run build` runs `tsc --noEmit` (the project has no ESLint config, so `tsc --noEmit` is the type/lint gate) followed by `vite build`.
- Desktop dev: `npm run desktop:dev` runs Vite + Electron together.

### Building the standalone Windows exe
- `npm run desktop:build:win` builds the **NSIS installer**; the electron-builder config also defines a **portable** single-file target. Output goes to `release/` (git-ignored).
- Building Windows targets on Linux downloads the win32 Electron binaries (needs network). The **portable** target builds with no extra system deps: `npx electron-builder --win portable --x64`.
- The **NSIS installer** target additionally requires `wine` on the PATH (system dependency; install separately, e.g. `apt-get install -y wine`). Without wine the installer step fails with `spawn wine ENOENT` while the portable target still succeeds.
- The sql.js `.wasm` is bundled via `asarUnpack`; `electron/db.cjs` reads it with `fs.readFileSync(require.resolve(...))`, which works inside the asar.

### Non-obvious caveats
- **Electron GUI does not open a visible window in this headless VM**, but you can run/verify it headlessly: `xvfb-run -a node_modules/.bin/electron . --no-sandbox --disable-gpu --user-data-dir=/tmp/jb7data`. Useful for confirming the SQLite file is created/persisted. For UI testing prefer the Vite dev server in a browser (`http://127.0.0.1:5173/`).
- Desktop state lives in the SQLite file under `--user-data-dir` (or the OS userData path); delete that file or use the in-app "Restore demo data" / backup controls to reset.
