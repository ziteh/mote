import { createSignal } from "solid-js";

const KEY = "editor-mode";

const [split, setSplitSignal] = createSignal(
  localStorage.getItem(KEY) === "split",
);

export { split };

export function setSplit(value: boolean) {
  setSplitSignal(value);
  localStorage.setItem(KEY, value ? "split" : "single");
}
