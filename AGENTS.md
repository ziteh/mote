# AGENTS.md

Web-based Markdown note app. `.md` files on disk are the single source of truth; the index DB under the cache dir is derived and rebuildable.

## Layout

- `crates/core`: note store, frontmatter, parsing, id generation, indexing
- `crates/server`: HTTP routes, DTOs, OpenAPI, static file serving
- `web`: SolidJS + Vite + TypeScript frontend
  - `web/src/editor`: CodeMirror extensions (wikilink, links, table, image, task, theme); registered in `extensions.ts`
  - `web/src/components`: UI components (`NotePane` hosts the editor)
  - `web/src/lib`: shared state/helpers (persisted settings, editor mode, panel sizes)
  - `web/src/locales`: i18n; every new user-facing string needs an entry in every locale file
  - `web/src/assets`: SVG icons (Phosphor style, source URL comment on first line)
  - `web/src/api/schema.d.ts`: generated, do not edit by hand
- `openapi.json`: generated, committed, and checked by a test
- `Notes/`: notes used for local development; included in .gitignore

## Commands

Commands are defined in `Taskfile.yml` and `web/package.json` scripts; read them instead of guessing.

- Dev: `task dev` (backend and frontend together)
- Regenerate `openapi.json` and `schema.d.ts` after changing server DTOs or routes: `task openapi`
- Bump version: update `crates/core/Cargo.toml`, `crates/server/Cargo.toml` (including its `mote-core` dependency version) and `web/package.json`, then run `task openapi` (refreshes `Cargo.lock` and `openapi.json`)
- Rust tests: `cargo test`
- Frontend type check: `pnpm --dir web typecheck`
- Frontend lint: `pnpm --dir web lint`; auto-fix: `pnpm --dir web lint:fix`
- Frontend unit tests: `pnpm --dir web test` (node's built-in runner; pure logic only, e.g. table model)
