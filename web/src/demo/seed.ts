import { normalizeTags } from "./model";

export interface SeedNote {
  id: string;
  notebook: string;
  tags: string[];
  body: string;
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;
const TAGS = /^tags:\s*\[(.*)\]\s*$/m;

const files = import.meta.glob("./notes/*/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const seedNotes: SeedNote[] = Object.entries(files).map(
  ([path, text]) => {
    const [, notebook, file] =
      /\.\/notes\/([^/]+)\/([^/]+)\.md$/.exec(path) ?? [];
    const header = FRONTMATTER.exec(text)?.[1] ?? "";
    return {
      id: file,
      notebook,
      tags: normalizeTags(TAGS.exec(header)?.[1].split(",") ?? []),
      body: text.replace(FRONTMATTER, ""),
    };
  },
);

export const seedNotebooks = [
  ...new Set(["Inbox", ...seedNotes.map((n) => n.notebook)]),
];
