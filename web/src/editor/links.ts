import { syntaxTree } from "@codemirror/language";
import type { Extension, Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { inCode } from "./syntax";

const SAFE_URL = /^https?:\/\//i;

function buildDecorations(view: EditorView) {
  const { state } = view;
  const ranges: Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter(node) {
        if (node.name !== "URL" || inCode(state, node.from)) return;
        const url = state.sliceDoc(node.from, node.to);
        if (!SAFE_URL.test(url)) return;
        ranges.push(
          Decoration.mark({
            class: "cm-url",
            attributes: { "data-url": url },
          }).range(node.from, node.to),
        );
      },
    });
  }
  return Decoration.set(ranges, true);
}

/** Underlines http(s) URLs; clicking one opens it in a new tab. */
export function urlLinks(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view);
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
      eventHandlers: {
        mousedown(event) {
          if (event.button !== 0) return false;
          const target = event.target as HTMLElement;
          const url = target.closest<HTMLElement>(".cm-url")?.dataset.url;
          if (!url) return false;
          event.preventDefault();
          window.open(url, "_blank", "noopener,noreferrer");
          return true;
        },
      },
    },
  );
}
