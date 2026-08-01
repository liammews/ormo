import { describe, expect, it } from "vitest";
import {
  comboboxItemHtmlToText,
  createComboboxRootId,
  getComboboxSsrContext,
  renderWithComboboxContext,
} from "../../src/internal/combobox-ssr-context";

describe("combobox SSR context", () => {
  it("creates unique root ids", () => {
    expect(createComboboxRootId()).not.toBe(createComboboxRootId());
  });

  it("excludes ItemIndicator content from inferred text", () => {
    expect(
      comboboxItemHtmlToText(
        "France <span data-ormo-combobox-item-indicator>check</span>",
      ),
    ).toBe("France");
  });

  it("isolates nested contexts", async () => {
    const outer = {
      rootId: "outer",
      defaultValue: "",
      items: [],
      groupCount: 0,
    };
    const inner = { ...outer, rootId: "inner", items: [] };
    await renderWithComboboxContext(outer, async () => {
      expect(getComboboxSsrContext()).toBe(outer);
      await renderWithComboboxContext(inner, async () => {
        expect(getComboboxSsrContext()).toBe(inner);
        return "";
      });
      expect(getComboboxSsrContext()).toBe(outer);
      return "";
    });
  });
});
