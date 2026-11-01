# Mote

A simple web-based Markdown note-taking app. `.md` is the single source of truth. [Demo](https://mote.ziteh.dev)

- Single executable, the frontend is embedded in the binary
- Embedded image
- Wikilink
- Backlinks

> [!NOTE]
> This repo contains LLM-assisted code; please review and validate it as appropriate.

## Usage

```sh
mote-server # Default notes directory: Notes/
mote-server --notes-dir path/to/notes
mote-server --port 5393
mote-server --help # More info
```

<http://localhost:5393>

Notes directory:

```text
Notes/
├── Inbox/         # Default notebook
│   └── <id>.md
├── <notebook>/    # More notebook
│   └── <id>.md
├── .assets/
│   └── <hash>.<ext>
├── .trash/
└── .cache/        # Default location, can be changed with --cache-dir
    └── index.db
```

Frontmatter:

```yaml
id: <nanoID>
created: <RFC 3339>
updated: <RFC 3339>
tags:
  - <tag>
```

## Development

```sh
# BE
cargo run -p mote-server
# or with Swagger UI at /swagger-ui
cargo run -p mote-server --features swagger

# FE
pnpm --dir web install
pnpm --dir web dev

# Test
cargo test

# Formatter & linter
cargo fmt
cargo clippy
pnpm --dir web exec biome check .. --write
```

Generate `openapi.json` after the API changes:

```sh
cargo run -p mote-server -- --openapi > openapi.json
pnpm --dir web exec biome format --write ../openapi.json
pnpm --dir web gen:api
```

Release build:

```sh
pnpm --dir web build
cargo build --release -p mote-server
```

Cross-compile a statically linked Linux x86_64 binary (musl) with [cargo-zigbuild](https://github.com/rust-cross/cargo-zigbuild). Requires `zig`, which is needed to build the bundled SQLite:

```sh
rustup target add x86_64-unknown-linux-musl
pnpm --dir web build
cargo zigbuild --release -p mote-server --target x86_64-unknown-linux-musl
```

The output is `target/x86_64-unknown-linux-musl/release/mote-server`. It has no glibc dependency, so it can be copied to and run on any Linux x86_64 host.

## Tech Stack

- BE
  - rusqlite
  - axum
  - utoipa
  - blake3
  - nanoid
- FE
  - Solid.js
  - SolidUI
  - CodeMirror
  - Phosphoricons
