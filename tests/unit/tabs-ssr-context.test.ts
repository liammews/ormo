import { describe, expect, it } from "vitest";

import {
  createTabsRootId,
  ensureTabsSsrPart,
  getTabsSsrContext,
  isPanelSelected,
  renderWithTabsContext,
  resolveTabSelected,
} from "../../src/internal/tabs-ssr-context";

describe("tabs SSR context", () => {
  it("exposes the active context to nested renders", async () => {
    const context = {
      defaultValue: "second",
      orientation: "horizontal" as const,
      disabled: false,
      selectedValue: null as string | null,
      rootId: createTabsRootId(),
      nextIndex: 0,
      parts: new Map(),
    };
    let seen = false;

    await renderWithTabsContext(context, async () => {
      const active = getTabsSsrContext();
      expect(active).toBe(context);
      seen = true;
      return "";
    });

    expect(seen).toBe(true);
    expect(getTabsSsrContext()).toBeUndefined();
  });

  it("selects the default value and pairs tab/panel ids by value", async () => {
    const context = {
      defaultValue: "projects",
      orientation: "horizontal" as const,
      disabled: false,
      selectedValue: null as string | null,
      rootId: "ormo-tabs-test",
      nextIndex: 0,
      parts: new Map(),
    };

    await renderWithTabsContext(context, async () => {
      expect(resolveTabSelected(context, "overview", false)).toBe(false);
      expect(resolveTabSelected(context, "projects", false)).toBe(true);
      expect(context.selectedValue).toBe("projects");

      const tabPart = ensureTabsSsrPart(context, "projects", {
        tabId: "custom-tab",
      });
      const panelPart = ensureTabsSsrPart(context, "projects");

      expect(panelPart).toBe(tabPart);
      expect(tabPart.tabId).toBe("custom-tab");
      expect(tabPart.panelId).toBe("ormo-tabs-test-panel-1");
      expect(isPanelSelected(context, "projects")).toBe(true);
      expect(isPanelSelected(context, "overview")).toBe(false);

      return "";
    });
  });

  it("selects the first enabled tab when defaultValue is omitted", async () => {
    const context = {
      defaultValue: undefined,
      orientation: "vertical" as const,
      disabled: false,
      selectedValue: null as string | null,
      rootId: "ormo-tabs-test",
      nextIndex: 0,
      parts: new Map(),
    };

    await renderWithTabsContext(context, async () => {
      expect(resolveTabSelected(context, "a", true)).toBe(false);
      expect(resolveTabSelected(context, "b", false)).toBe(true);
      expect(context.selectedValue).toBe("b");
      return "";
    });
  });
});
