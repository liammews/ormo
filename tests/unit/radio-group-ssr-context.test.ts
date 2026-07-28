import { describe, expect, it } from "vitest";

import {
  createRadioGroupRootId,
  getRadioGroupSsrContext,
  renderWithRadioGroupContext,
} from "../../src/internal/radio-group-ssr-context";

describe("radio-group-ssr-context", () => {
  it("creates unique root ids", () => {
    expect(createRadioGroupRootId()).not.toBe(createRadioGroupRootId());
  });

  it("exposes the active context while rendering", async () => {
    const context = {
      name: "delivery",
      disabled: false,
      required: true,
      defaultValue: "express",
      rootId: "group-1",
      labelId: "group-1-label",
      labelIds: [],
    };

    const result = await renderWithRadioGroupContext(context, async () => {
      const active = getRadioGroupSsrContext();
      expect(active).toBe(context);
      active!.labelIds.push("group-1-label");
      return "ok";
    });

    expect(result).toBe("ok");
    expect(context.labelIds).toEqual(["group-1-label"]);
    expect(getRadioGroupSsrContext()).toBeUndefined();
  });
});
