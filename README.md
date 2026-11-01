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

## Docker

The [image](https://github.com/ziteh/mote/pkgs/container/mote) contains only the static binary, so it has no shell.

```sh
docker run -d --name web-note \
  -p 5393:5393 \
  -e BIND=0.0.0.0 \
  -e NOTES_DIR=/data/notes \
  -v ./Notes:/data/notes \
  ghcr.io/ziteh/web-note:<version>
```

Or with Compose:

```yaml
services:
  web-note:
    image: ghcr.io/ziteh/web-note:<version>
    restart: unless-stopped
    user: "1000:1000" # Match the owner of the notes directory
    ports:
      - "5393:5393"
    environment:
      BIND: 0.0.0.0 # The default loopback is unreachable from outside the container
      NOTES_DIR: /data/notes
      CACHE_DIR: /data/cache # Optional, defaults to .cache inside the notes directory
    volumes:
      - ./Notes:/data/notes
      - cache:/data/cache

volumes:
  cache:
```

```sh
docker compose up -d
docker compose pull && docker compose up -d # Upgrade after changing the tag
```

There is no authentication. Do not expose the port to untrusted networks; bind it to loopback (`127.0.0.1:5393:5393`) or put it behind an authenticating reverse proxy.

## Logging

Logs are plain text on stderr. Set the level with `RUST_LOG` (default `info`; `debug` also shows every request). There is no built-in log file; redirect stderr instead:

```sh
mote-server 2>> mote.log
docker logs web-note # Configure rotation with the Docker `--log-opt` options
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
