import { createSignal } from "solid-js";

const KEY = "panel-sizes";

function load(): number[] | undefined {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (
      Array.isArray(parsed) &&
      parsed.length === 3 &&
      parsed.every((n) => typeof n === "number")
    ) {
      return parsed;
    }
  } catch {}
  return undefined;
}

const [panelSizes, setPanelSizesSignal] = createSignal(load());

export { panelSizes };

export function setPanelSizes(sizes: number[]) {
  setPanelSizesSignal(sizes);
  localStorage.setItem(KEY, JSON.stringify(sizes));
}
