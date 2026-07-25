import { describe, expect, it } from "vitest";

import {
  createCheckboxGroupRootId,
  getCheckboxGroupSsrContext,
  normalizeDefaultValues,
  renderWithCheckboxGroupContext,
} from "../../src/internal/checkbox-group-ssr-context";

describe("checkbox-group-ssr-context", () => {
  it("normalizes default values into a set", () => {
    expect([...normalizeDefaultValues(["https", "http"])]).toEqual([
      "https",
      "http",
    ]);
    expect(normalizeDefaultValues(undefined).size).toBe(0);
  });

  it("creates unique root ids", () => {
    expect(createCheckboxGroupRootId()).not.toBe(createCheckboxGroupRootId());
  });

  it("exposes the active context while rendering", async () => {
    const context = {
      name: "protocols",
      disabled: false,
      defaultValue: normalizeDefaultValues(["https"]),
      rootId: "group-1",
      labelId: "group-1-label",
      hasLabel: false,
    };

    const result = await renderWithCheckboxGroupContext(context, async () => {
      const active = getCheckboxGroupSsrContext();
      expect(active).toBe(context);
      active!.hasLabel = true;
      return "ok";
    });

    expect(result).toBe("ok");
    expect(context.hasLabel).toBe(true);
    expect(getCheckboxGroupSsrContext()).toBeUndefined();
  });
});
