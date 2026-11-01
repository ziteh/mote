import type { NoteMeta } from "~/api/client";

const SUMMARY_CHARS = 100;
const SNIPPET_BEFORE = 30;
const SNIPPET_AFTER = 60;
const WIKILINK = /\[\[([0-9a-z]+)(?:\|[^[\]\n]*)?\]\]/g;
const TASK = /^\s*[-*+] \[( |x|X)\]/;

export interface StoredNote {
  id: string;
  notebook: string;
  tags: string[];
  body: string;
  created: string;
  updated: string;
  version: number;
}

export function normalizeTags(tags: string[]) {
  const out: string[] = [];
  for (const tag of tags) {
    const t = tag.trim().normalize("NFC").toLowerCase();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/** Lines outside fenced code blocks. */
function proseLines(body: string) {
  let fence = false;
  return body.split("\n").filter((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence;
      return false;
    }
    return !fence;
  });
}

function title(body: string) {
  for (const line of proseLines(body)) {
    const m = /^# +(.*?)\s*#*\s*$/.exec(line);
    if (m?.[1]) return m[1];
  }
  return null;
}

function summary(body: string) {
  const line = body
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#"));
  return [...(line ?? "")].slice(0, SUMMARY_CHARS).join("");
}

function todo(body: string) {
  const lines = body.split("\n");
  if (lines[0]?.trim() !== "TODO:") return null;
  let done = 0;
  let total = 0;
  for (const line of lines.slice(1)) {
    if (/^# /.test(line)) break;
    const m = TASK.exec(line);
    if (!m) continue;
    total += 1;
    if (m[1] !== " ") done += 1;
  }
  return total > 0 ? { done, total } : null;
}

export function linkedIds(body: string) {
  const text = proseLines(body).join("\n");
  return [...text.matchAll(WIKILINK)].map((m) => m[1]);
}

function snippet(body: string, needle: string) {
  const hay = [...body];
  const lower = [...body.toLowerCase()];
  const target = [...needle.toLowerCase()];
  if (hay.length !== lower.length) return null;
  for (let i = 0; i + target.length <= hay.length; i++) {
    if (!target.every((c, j) => lower[i + j] === c)) continue;
    const from = Math.max(0, i - SNIPPET_BEFORE);
    const to = Math.min(hay.length, i + target.length + SNIPPET_AFTER);
    return {
      text: hay.slice(from, to).join("").replace(/\n/g, " "),
      start: i - from,
      end: i - from + target.length,
    };
  }
  return null;
}

export function matches(note: StoredNote, text: string) {
  const needle = text.toLowerCase();
  return (
    (title(note.body) ?? "").toLowerCase().includes(needle) ||
    note.body.toLowerCase().includes(needle)
  );
}

export function toMeta(note: StoredNote, query?: string): NoteMeta {
  return {
    id: note.id,
    path: `${note.notebook}/${note.id}.md`,
    notebook: note.notebook,
    title: title(note.body),
    summary: summary(note.body),
    tags: [...note.tags].sort(),
    created: note.created,
    updated: note.updated,
    todo: todo(note.body),
    snippet: query ? snippet(note.body, query) : null,
  };
}
