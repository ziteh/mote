import {
  linkedIds,
  matches,
  normalizeTags,
  type StoredNote,
  toMeta,
} from "./model";
import { seedNotebooks, seedNotes } from "./seed";

const DEFAULT_NOTEBOOK = "Inbox";
const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const ID_LENGTH = 12;

interface TrashedNote {
  key: string;
  trashedAt: number;
  note: StoredNote;
}

class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

const notFound = (code: string) => new HttpError(404, code);

const notebooks = new Set(seedNotebooks);
const notes = new Map<string, StoredNote>();
let trash: TrashedNote[] = [];

const now = () => new Date().toISOString();

for (const [i, seed] of seedNotes.entries()) {
  const stamp = new Date(Date.now() - (i + 1) * 3_600_000).toISOString();
  notes.set(seed.id, {
    ...seed,
    created: stamp,
    updated: stamp,
    version: 1,
  });
}

function generateId() {
  let id = "";
  for (let i = 0; i < ID_LENGTH; i++) {
    id += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  }
  return id;
}

function withTrailingNewline(body: string) {
  const text = body.replace(/\r\n/g, "\n");
  return text.endsWith("\n") ? text : `${text}\n`;
}

function validName(raw: string) {
  const name = raw.trim().normalize("NFC");
  const bad =
    !name ||
    name.startsWith(".") ||
    /[/\\]/.test(name) ||
    // biome-ignore lint/suspicious/noControlCharactersInRegex: mirrors the server's control character check
    /[\u0000-\u001f\u007f]/.test(name);
  if (bad) throw new HttpError(400, "invalid_name");
  return name;
}

function existingNotebook(raw: string) {
  const name = validName(raw);
  if (!notebooks.has(name)) throw notFound("notebook_not_found");
  return name;
}

function getNote(id: string) {
  const note = notes.get(id);
  if (!note) throw notFound("note_not_found");
  return note;
}

function view(note: StoredNote) {
  return {
    meta: toMeta(note),
    body: note.body,
    version: String(note.version),
  };
}

function listNotes(params: URLSearchParams) {
  const notebook = params.get("notebook");
  const tags = normalizeTags(params.getAll("tag"));
  const q = params.get("q") || undefined;
  return [...notes.values()]
    .filter((n) => !notebook || n.notebook === notebook.normalize("NFC"))
    .filter((n) => tags.every((t) => n.tags.includes(t)))
    .filter((n) => !q || matches(n, q))
    .map((n) => toMeta(n, q));
}

function counts(values: string[]) {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return map;
}

type Body = Record<string, unknown>;
type Handler = (m: RegExpExecArray, ctx: Context) => unknown;

interface Context {
  params: URLSearchParams;
  body: Body;
}

const NO_CONTENT = Symbol("no content");
const status = () => ({ errors: [], duplicates: [] });

const routes: [string, RegExp, Handler, number?][] = [
  ["GET", /^\/api\/notes$/, (_, c) => listNotes(c.params)],
  [
    "POST",
    /^\/api\/notes$/,
    (_, { body }) => {
      const notebook = existingNotebook(String(body.notebook));
      const created = now();
      const note: StoredNote = {
        id: generateId(),
        notebook,
        tags: normalizeTags((body.tags as string[] | undefined) ?? []),
        body: withTrailingNewline(String(body.body)),
        created,
        updated: created,
        version: 1,
      };
      notes.set(note.id, note);
      return view(note);
    },
    201,
  ],
  ["GET", /^\/api\/notes\/([^/]+)$/, (m) => view(getNote(m[1]))],
  [
    "PUT",
    /^\/api\/notes\/([^/]+)$/,
    (m, { body }) => {
      const note = getNote(m[1]);
      if (String(note.version) !== body.base_version && !body.force) {
        throw new HttpError(409, "conflict");
      }
      const text = String(body.body).replace(/\r\n/g, "\n");
      const tags = normalizeTags((body.tags as string[] | undefined) ?? []);
      if (note.body !== text || note.tags.join() !== tags.join()) {
        note.body = text;
        note.tags = tags;
        note.updated = now();
        note.version += 1;
      }
      return view(note);
    },
  ],
  [
    "DELETE",
    /^\/api\/notes\/([^/]+)$/,
    (m) => {
      const note = getNote(m[1]);
      notes.delete(note.id);
      const trashedAt = Date.now();
      trash.push({ key: `${note.id}~${trashedAt}.md`, trashedAt, note });
      return NO_CONTENT;
    },
  ],
  [
    "GET",
    /^\/api\/notes\/([^/]+)\/backlinks$/,
    (m) =>
      [...notes.values()]
        .filter((n) => n.id !== m[1] && linkedIds(n.body).includes(m[1]))
        .map((n) => toMeta(n)),
  ],
  [
    "POST",
    /^\/api\/notes\/([^/]+)\/move$/,
    (m, { body }) => {
      const notebook = existingNotebook(String(body.notebook));
      const note = getNote(m[1]);
      note.notebook = notebook;
      return view(note);
    },
  ],
  ["POST", /^\/api\/format$/, (_, { body }) => ({ body: body.body })],
  [
    "GET",
    /^\/api\/notebooks$/,
    () => {
      const perNotebook = counts([...notes.values()].map((n) => n.notebook));
      return [...notebooks]
        .sort()
        .map((name) => ({ name, count: perNotebook.get(name) ?? 0 }));
    },
  ],
  [
    "POST",
    /^\/api\/notebooks$/,
    (_, { body }) => {
      const name = validName(String(body.name));
      if (notebooks.has(name)) throw new HttpError(409, "notebook_exists");
      notebooks.add(name);
      return undefined;
    },
    201,
  ],
  [
    "PATCH",
    /^\/api\/notebooks\/([^/]+)$/,
    (m, { body }) => {
      const name = existingNotebook(decodeURIComponent(m[1]));
      const next = validName(String(body.name));
      if (name === DEFAULT_NOTEBOOK) {
        throw new HttpError(400, "protected_notebook");
      }
      if (notebooks.has(next)) throw new HttpError(409, "notebook_exists");
      notebooks.delete(name);
      notebooks.add(next);
      for (const n of notes.values()) {
        if (n.notebook === name) n.notebook = next;
      }
      return NO_CONTENT;
    },
  ],
  [
    "DELETE",
    /^\/api\/notebooks\/([^/]+)$/,
    (m) => {
      const name = existingNotebook(decodeURIComponent(m[1]));
      if (name === DEFAULT_NOTEBOOK) {
        throw new HttpError(400, "protected_notebook");
      }
      if ([...notes.values()].some((n) => n.notebook === name)) {
        throw new HttpError(409, "notebook_not_empty");
      }
      notebooks.delete(name);
      return NO_CONTENT;
    },
  ],
  [
    "GET",
    /^\/api\/tags$/,
    () =>
      [...counts([...notes.values()].flatMap((n) => n.tags))]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([tag, count]) => ({ tag, count })),
  ],
  [
    "POST",
    /^\/api\/tags\/rename$/,
    (_, { body }) => {
      const from = String(body.from).trim().normalize("NFC").toLowerCase();
      const [to] = normalizeTags([String(body.to)]);
      if (!to) throw new HttpError(400, "invalid_name");
      if (from === to) return { affected: 0 };
      let affected = 0;
      for (const n of notes.values()) {
        if (!n.tags.includes(from)) continue;
        n.tags = normalizeTags(n.tags.map((t) => (t === from ? to : t)));
        n.updated = now();
        n.version += 1;
        affected += 1;
      }
      return { affected };
    },
  ],
  [
    "GET",
    /^\/api\/trash$/,
    () =>
      [...trash]
        .sort((a, b) => b.trashedAt - a.trashedAt)
        .map(({ key, trashedAt, note }) => ({
          key,
          notebook: note.notebook,
          id: note.id,
          title: toMeta(note).title,
          trashed_at_millis: trashedAt,
        })),
  ],
  [
    "DELETE",
    /^\/api\/trash$/,
    () => {
      trash = [];
      return NO_CONTENT;
    },
  ],
  [
    "DELETE",
    /^\/api\/trash\/([^/]+)$/,
    (m) => {
      const key = decodeURIComponent(m[1]);
      if (!trash.some((t) => t.key === key)) {
        throw notFound("trash_item_not_found");
      }
      trash = trash.filter((t) => t.key !== key);
      return NO_CONTENT;
    },
  ],
  [
    "POST",
    /^\/api\/trash\/([^/]+)\/restore$/,
    (m) => {
      const key = decodeURIComponent(m[1]);
      const item = trash.find((t) => t.key === key);
      if (!item) throw notFound("trash_item_not_found");
      trash = trash.filter((t) => t !== item);
      const { note } = item;
      if (notes.has(note.id)) note.id = generateId();
      notebooks.add(note.notebook);
      notes.set(note.id, note);
      return view(note);
    },
  ],
  ["GET", /^\/api\/assets\/orphans$/, () => []],
  ["POST", /^\/api\/assets\/orphans\/trash$/, () => ({ count: 0 })],
  ["GET", /^\/api\/system\/status$/, status],
  ["POST", /^\/api\/system\/rescan$/, status],
  ["POST", /^\/api\/system\/duplicates\/dismiss$/, () => NO_CONTENT],
];

function json(data: unknown, code: number) {
  return new Response(JSON.stringify(data), {
    status: code,
    headers: { "Content-Type": "application/json" },
  });
}

/** In-memory stand-in for the backend; state resets on reload. */
export async function demoFetch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as Body;
  for (const [method, pattern, handler, okStatus = 200] of routes) {
    const match = request.method === method ? pattern.exec(url.pathname) : null;
    if (!match) continue;
    try {
      const result = handler(match, { params: url.searchParams, body });
      if (result === NO_CONTENT) return new Response(null, { status: 204 });
      if (result === undefined) {
        return new Response(null, {
          status: okStatus,
          headers: { "Content-Length": "0" },
        });
      }
      return json(result, okStatus);
    } catch (e) {
      if (!(e instanceof HttpError)) throw e;
      return json({ code: e.code, message: e.code }, e.status);
    }
  }
  return json({ code: "not_found", message: "not found" }, 404);
}
