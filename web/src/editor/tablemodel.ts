export type Align = "left" | "center" | "right" | null;

/** Row 0 is the header; every row has one cell per column. */
export interface TableModel {
  aligns: Align[];
  rows: string[][];
}

const DELIMITER_CELL = /^(:?)-+(:?)$/;

function splitRow(line: string) {
  const text = line.trim();
  const cells: string[] = [];
  let cell = "";
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\" && text[i + 1] === "|") {
      cell += "|";
      i++;
    } else if (text[i] === "|") {
      cells.push(cell);
      cell = "";
    } else {
      cell += text[i];
    }
  }
  cells.push(cell);
  if (text.startsWith("|")) cells.shift();
  if (text.endsWith("|") && !text.endsWith("\\|")) cells.pop();
  return cells.map((c) => c.trim());
}

function fit(cells: string[], count: number) {
  return Array.from({ length: count }, (_, i) => cells[i] ?? "");
}

export function parseTable(source: string): TableModel | null {
  const lines = source.split("\n");
  if (lines.length < 2) return null;
  const aligns: Align[] = [];
  for (const cell of splitRow(lines[1])) {
    const match = DELIMITER_CELL.exec(cell);
    if (!match) return null;
    const [, left, right] = match;
    aligns.push(
      left && right ? "center" : right ? "right" : left ? "left" : null,
    );
  }
  const rows = [lines[0], ...lines.slice(2)]
    .filter((line) => line.trim() !== "")
    .map((line) => fit(splitRow(line), aligns.length));
  return { aligns, rows };
}

const DELIMITERS: Record<string, string> = {
  left: ":---",
  center: ":---:",
  right: "---:",
};

function formatRow(cells: string[]) {
  return `| ${cells.map((c) => c.replaceAll("|", "\\|")).join(" | ")} |`;
}

export function serializeTable({ aligns, rows }: TableModel) {
  const delimiter = aligns.map((a) => (a ? DELIMITERS[a] : "---"));
  return [
    formatRow(rows[0]),
    `| ${delimiter.join(" | ")} |`,
    ...rows.slice(1).map(formatRow),
  ].join("\n");
}

export function setCell(
  model: TableModel,
  row: number,
  col: number,
  value: string,
): TableModel {
  return {
    ...model,
    rows: model.rows.map((cells, r) =>
      r === row ? cells.map((c, i) => (i === col ? value : c)) : cells,
    ),
  };
}

export function insertRow(model: TableModel, at: number): TableModel {
  const empty = fit([], model.aligns.length);
  return { ...model, rows: model.rows.toSpliced(at, 0, empty) };
}

export function deleteRow(model: TableModel, at: number): TableModel {
  return { ...model, rows: model.rows.toSpliced(at, 1) };
}

export function insertColumn(model: TableModel, at: number): TableModel {
  return {
    aligns: model.aligns.toSpliced(at, 0, null),
    rows: model.rows.map((cells) => cells.toSpliced(at, 0, "")),
  };
}

export function deleteColumn(model: TableModel, at: number): TableModel {
  return {
    aligns: model.aligns.toSpliced(at, 1),
    rows: model.rows.map((cells) => cells.toSpliced(at, 1)),
  };
}

export function setAlign(
  model: TableModel,
  col: number,
  align: Align,
): TableModel {
  return {
    ...model,
    aligns: model.aligns.map((a, i) => (i === col ? align : a)),
  };
}
