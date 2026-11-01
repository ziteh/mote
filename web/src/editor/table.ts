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
    const el = document.createElement("div");
    el.className = "cm-table";
    el.innerHTML = DOMPurify.sanitize(
      marked.parse(this.source, { async: false }) as string,
    );
    el.addEventListener("mousedown", (event) => {
      const rect = el.getBoundingClientRect();
      const onScrollbar =
        event.clientY - rect.top >= el.clientHeight ||
        event.clientX - rect.left >= el.clientWidth;
      if (onScrollbar) return;
      view.dispatch({ selection: { anchor: view.posAtDOM(el) } });
      view.focus();
    });
    return el;
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
      const touched = state.selection.ranges.some(
        (r) => r.from <= node.to && r.to >= node.from,
      );
      if (touched) return false;
      ranges.push(
        Decoration.replace({
          widget: new TableWidget(state.sliceDoc(node.from, node.to)),
          block: true,
        }).range(node.from, node.to),
      );
      return false;
    },
  });
  return Decoration.set(ranges);
}

/** Renders a table as HTML while the cursor is outside it. */
export function tableWidgets(): Extension {
  return StateField.define({
    create: buildDecorations,
    update: (value, tr) =>
      tr.docChanged || tr.selection ? buildDecorations(tr.state) : value,
    provide: (field) => EditorView.decorations.from(field),
  });
}
