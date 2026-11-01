import { syntaxTree } from "@codemirror/language";
import {
  type EditorState,
  type Extension,
  type Range,
  StateField,
} from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { type MessageKey, t } from "~/lib/i18n";
import {
  type Align,
  deleteColumn,
  deleteRow,
  insertColumn,
  insertRow,
  parseTable,
  serializeTable,
  setAlign,
  setCell,
  type TableModel,
} from "./tablemodel";

interface Cell {
  row: number;
  col: number;
}

/** Cell to edit once the widget rebuilt by the next document change mounts. */
let pendingFocus: Cell | null = null;

function renderCell(td: HTMLElement, text: string) {
  td.innerHTML =
    DOMPurify.sanitize(marked.parseInline(text, { async: false }) as string) ||
    "​";
}

function mountTable(view: EditorView, source: string) {
  const model = parseTable(source) as TableModel;
  const root = document.createElement("div");
  root.className = "cm-table-root";
  const scroller = document.createElement("div");
  scroller.className = "cm-table";
  const table = document.createElement("table");
  const head = table.createTHead();
  const body = table.createTBody();
  scroller.append(table);
  const toolbar = document.createElement("div");
  toolbar.className = "cm-table-toolbar";
  root.append(scroller, toolbar);

  let active: { cell: Cell; td: HTMLElement; original: string } | null = null;

  model.rows.forEach((cells, row) => {
    const tr = (row === 0 ? head : body).insertRow();
    cells.forEach((text, col) => {
      const td = document.createElement(row === 0 ? "th" : "td");
      td.dataset.row = String(row);
      td.dataset.col = String(col);
      const align = model.aligns[col];
      if (align) td.style.textAlign = align;
      renderCell(td, text);
      tr.append(td);
    });
  });

  const cellAt = ({ row, col }: Cell) =>
    table.rows[row]?.cells[col] as HTMLElement | undefined;

  const setActive = (on: boolean) => {
    root.classList.toggle("cm-table-active", on);
    view.requestMeasure();
  };

  const edit = (cell: Cell) => {
    const td = cellAt(cell);
    if (!td || active?.td === td) return;
    const original = model.rows[cell.row][cell.col];
    td.textContent = original;
    td.contentEditable = "plaintext-only";
    if (td.contentEditable !== "plaintext-only") td.contentEditable = "true";
    td.classList.add("cm-table-editing");
    td.focus();
    const range = document.createRange();
    range.selectNodeContents(td);
    range.collapse(false);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    active = { cell, td, original };
    setActive(true);
  };

  /** Stops editing and returns the new text when it differs from the source. */
  const leave = () => {
    if (!active) return null;
    const { cell, td, original } = active;
    active = null;
    const value = (td.textContent ?? "").trim().replace(/\s*\n\s*/g, "<br>");
    td.removeAttribute("contenteditable");
    td.classList.remove("cm-table-editing");
    renderCell(td, value);
    setActive(false);
    return value === original ? null : { cell, value };
  };

  const apply = (next: TableModel, focus: Cell | null) => {
    const text = serializeTable(next);
    if (text === source) {
      if (focus) edit(focus);
      return;
    }
    const from = view.posAtDOM(root);
    const to = from + source.length;
    if (view.state.sliceDoc(from, to) !== source) return;
    pendingFocus = focus;
    view.dispatch({ changes: { from, to, insert: text } });
    pendingFocus = null;
  };

  const commit = () => {
    const done = leave();
    return done
      ? setCell(model, done.cell.row, done.cell.col, done.value)
      : model;
  };

  const move = (target: Cell) => {
    let next = commit();
    if (target.row >= next.rows.length) {
      next = insertRow(next, next.rows.length);
    }
    if (next === model) edit(target);
    else apply(next, target);
  };

  table.addEventListener("mousedown", (event) => {
    const td = (event.target as Element).closest<HTMLElement>("td, th");
    if (!td || td === active?.td) return;
    event.preventDefault();
    move({ row: Number(td.dataset.row), col: Number(td.dataset.col) });
  });

  root.addEventListener("keydown", (event) => {
    if (!active || event.isComposing) return;
    const { row, col } = active.cell;
    const cols = model.aligns.length;
    let target: Cell;
    if (event.key === "Escape") {
      event.preventDefault();
      const { td, original } = active;
      active = null;
      td.removeAttribute("contenteditable");
      td.classList.remove("cm-table-editing");
      renderCell(td, original);
      setActive(false);
      view.focus();
      return;
    }
    if (event.key === "Enter") {
      target = { row: row + (event.shiftKey ? -1 : 1), col };
    } else if (event.key === "Tab") {
      if (event.shiftKey) {
        target =
          col > 0 ? { row, col: col - 1 } : { row: row - 1, col: cols - 1 };
      } else {
        target =
          col < cols - 1 ? { row, col: col + 1 } : { row: row + 1, col: 0 };
      }
    } else {
      return;
    }
    event.preventDefault();
    if (target.row >= 0) move(target);
  });

  root.addEventListener("focusout", (event) => {
    if (!active || event.target !== active.td) return;
    const next = commit();
    if (next !== model) apply(next, null);
  });

  const act = (
    change: (base: TableModel, cell: Cell) => [TableModel, Cell],
  ) => {
    if (!active) return;
    const { cell } = active;
    const [next, focus] = change(commit(), cell);
    apply(next, focus);
  };

  const button = (label: MessageKey, onClick: () => void) => {
    const el = document.createElement("button");
    el.type = "button";
    el.textContent = t(label);
    el.addEventListener("mousedown", (event) => event.preventDefault());
    el.addEventListener("click", onClick);
    toolbar.append(el);
  };

  const alignButton = (label: MessageKey, align: Align) =>
    button(label, () =>
      act((base, cell) => [
        setAlign(
          base,
          cell.col,
          base.aligns[cell.col] === align ? null : align,
        ),
        cell,
      ]),
    );

  button("tableAddRow", () =>
    act((base, cell) => {
      const at = Math.max(cell.row, 0) + 1;
      return [insertRow(base, at), { row: at, col: cell.col }];
    }),
  );
  button("tableAddColumn", () =>
    act((base, cell) => [
      insertColumn(base, cell.col + 1),
      { row: cell.row, col: cell.col + 1 },
    ]),
  );
  button("tableDeleteRow", () => {
    if (active && active.cell.row > 0) {
      act((base, cell) => {
        const next = deleteRow(base, cell.row);
        return [
          next,
          { row: Math.min(cell.row, next.rows.length - 1), col: cell.col },
        ];
      });
    }
  });
  button("tableDeleteColumn", () => {
    if (active && model.aligns.length > 1) {
      act((base, cell) => {
        const next = deleteColumn(base, cell.col);
        return [
          next,
          { row: cell.row, col: Math.min(cell.col, next.aligns.length - 1) },
        ];
      });
    }
  });
  alignButton("tableAlignLeft", "left");
  alignButton("tableAlignCenter", "center");
  alignButton("tableAlignRight", "right");

  if (pendingFocus) {
    const cell = pendingFocus;
    pendingFocus = null;
    requestAnimationFrame(() => edit(cell));
  }
  return root;
}

class TableWidget extends WidgetType {
  source: string;

  constructor(source: string) {
    super();
    this.source = source;
  }

  eq(other: TableWidget) {
    return other.source === this.source;
  }

  toDOM(view: EditorView) {
    return mountTable(view, this.source);
  }

  ignoreEvent() {
    return true;
  }
}

function buildDecorations(state: EditorState) {
  const ranges: Range<Decoration>[] = [];
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== "Table") return;
      const source = state.sliceDoc(node.from, node.to);
      const touched = state.selection.ranges.some(
        (r) => r.from <= node.to && r.to >= node.from,
      );
      if (!touched && parseTable(source)) {
        ranges.push(
          Decoration.replace({
            widget: new TableWidget(source),
            block: true,
          }).range(node.from, node.to),
        );
      }
      return false;
    },
  });
  return Decoration.set(ranges);
}

/** Shows a table as an editable grid while the cursor is outside its source. */
export function tableWidgets(): Extension {
  return StateField.define({
    create: buildDecorations,
    update: (value, tr) =>
      tr.docChanged || tr.selection ? buildDecorations(tr.state) : value,
    provide: (field) => EditorView.decorations.from(field),
  });
}
