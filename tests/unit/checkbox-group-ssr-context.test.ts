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
      labelIds: [],
      memberCount: 0,
      checkedMemberCount: 0,
    };

    const result = await renderWithCheckboxGroupContext(context, async () => {
      const active = getCheckboxGroupSsrContext();
      expect(active).toBe(context);
      active!.labelIds.push("group-1-label");
      active!.memberCount += 1;
      active!.checkedMemberCount += 1;
      return "ok";
    });

    expect(result).toBe("ok");
    expect(context.labelIds).toEqual(["group-1-label"]);
    expect(context.memberCount).toBe(1);
    expect(context.checkedMemberCount).toBe(1);
    expect(getCheckboxGroupSsrContext()).toBeUndefined();
  });
});
