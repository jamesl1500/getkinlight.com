import "@testing-library/jest-dom/vitest";
import { createElement, type SVGProps } from "react";
import { cleanup } from "@/test/render";
import { afterEach, vi } from "vitest";

const Icon = (props: SVGProps<SVGSVGElement>) => createElement("svg", props);

vi.mock("lucide-react", () => ({
  ArrowRight: Icon,
  ArrowUp: Icon,
  CalendarPlus: Icon,
  FileScan: Icon,
  MessageCircle: Icon,
  Mic: Icon,
  RefreshCw: Icon,
  Search: Icon,
  Sparkles: Icon,
  UsersRound: Icon,
  Wrench: Icon,
  X: Icon,
}));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(Element.prototype, "scrollIntoView", {
  configurable: true,
  value: () => undefined,
});

afterEach(() => cleanup());
