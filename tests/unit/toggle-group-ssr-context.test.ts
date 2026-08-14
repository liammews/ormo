import { describe, expect, it } from "vitest";
import {
  getToggleGroupSsrContext,
  renderWithToggleGroupContext,
} from "../../src/internal/toggle-group-ssr-context";

describe("Toggle Group SSR context", () => {
  it("isolates nested and concurrent contexts", async () => {
    const outer = {
      type: "single" as const,
      values: new Set(["a"]),
      disabled: false,
      orientation: "horizontal" as const,
      tabStopFound: false,
      items: [],
    };
    await renderWithToggleGroupContext(outer, async () => {
      expect(getToggleGroupSsrContext()).toBe(outer);
      const inner = { ...outer, values: new Set(["b"]) };
      await renderWithToggleGroupContext(inner, async () => {
        expect(getToggleGroupSsrContext()).toBe(inner);
        return "";
      });
      expect(getToggleGroupSsrContext()).toBe(outer);
      return "";
    });
    expect(getToggleGroupSsrContext()).toBeUndefined();
  });
});
