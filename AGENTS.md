# AGENTS.md

## Cursor Cloud specific instructions

### What this project is
JB7 UAE Auto Workshop is an offline-first **frontend-only** desktop/web app. There is **no backend, database, or external service** and **no secrets/auth** are required. State is persisted in browser/Electron `localStorage` under the key `jb7-uae-workshop-offline-v1`. Stack: Vite + React 19 + TypeScript, with an Electron wrapper for desktop packaging.

### Services and commands
There is a single service (the Vite app). Standard commands are defined in `package.json` scripts and `README.md`; use those rather than duplicating here:
- Dev server: `npm run dev` — Vite serves on `0.0.0.0:5173`. Open `http://127.0.0.1:5173/` to use the app in a browser.
- Tests: `npm test` (vitest, unit tests under `src/domain`).
- Lint/typecheck + build: `npm run build` runs `tsc --noEmit` (the project has no ESLint config, so `tsc --noEmit` is the type/lint gate) followed by `vite build`.
- Desktop dev: `npm run desktop:dev` runs Vite + Electron together.

### Non-obvious caveats
- **Electron GUI does not run in this headless cloud VM.** Do dev/manual testing against the Vite dev server in a browser (`http://127.0.0.1:5173/`); do not rely on `npm run desktop:dev` / `electron` launching a window here.
- `npm run desktop:build:win` (Windows NSIS installer) only works on a Windows build machine; it is not runnable in this environment.
- Because data lives in browser `localStorage`, manual test state persists across reloads in the same browser profile. Use the in-app "Reset demo data" / backup import-export controls (Settings) to reset state if needed.
