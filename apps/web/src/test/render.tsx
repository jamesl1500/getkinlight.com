import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];

export function render(ui: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(ui));
  const entry = { container, root };
  mounted.push(entry);

  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
      const index = mounted.indexOf(entry);
      if (index >= 0) mounted.splice(index, 1);
    },
  };
}

export function cleanup() {
  while (mounted.length > 0) {
    const entry = mounted.pop();
    if (!entry) continue;
    act(() => entry.root.unmount());
    entry.container.remove();
  }
}
