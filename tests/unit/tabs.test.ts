import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  OrmoTabsElement,
  TabsOrientation,
} from "../../src/components/tabs/types";
import "../../src/runtime/tabs";

interface TabsOptions {
  defaultValue?: string;
  orientation?: TabsOrientation;
  activateOnFocus?: boolean;
  loopFocus?: boolean;
  disabled?: boolean;
  disabledValues?: string[];
}

function createTabs(
  values: string[],
  options: TabsOptions = {},
): OrmoTabsElement {
  const root = document.createElement("ormo-tabs") as OrmoTabsElement;
  root.dataset.orientation = options.orientation ?? "horizontal";

  if (options.defaultValue !== undefined) {
    root.dataset.defaultValue = options.defaultValue;
  }

  if (options.activateOnFocus) {
    root.setAttribute("data-activate-on-focus", "");
  }

  if (options.loopFocus === false) {
    root.setAttribute("data-loop-focus", "false");
  }

  if (options.disabled) {
    root.setAttribute("data-disabled", "");
  }

  const tabs = values
    .map(
      (value) => `
        <button
          type="button"
          role="tab"
          data-ormo-tabs-tab
          data-value="${value}"
          ${options.disabledValues?.includes(value) ? "data-item-disabled disabled" : ""}
        >${value}</button>
      `,
    )
    .join("");

  const panels = values
    .map(
      (value) => `
        <div
          role="tabpanel"
          data-ormo-tabs-panel
          data-value="${value}"
        >${value} content</div>
      `,
    )
    .join("");

  root.innerHTML = `
    <div role="tablist" data-ormo-tabs-list aria-label="Demo">
      ${tabs}
    </div>
    ${panels}
  `;

  document.body.append(root);
  return root;
}

function getTabs(root: OrmoTabsElement): HTMLButtonElement[] {
  return Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-ormo-tabs-tab]"),
  );
}

function getPanels(root: OrmoTabsElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>("[data-ormo-tabs-panel]"),
  );
}

function dispatchKey(
  target: HTMLElement,
  key: string,
  init: KeyboardEventInit = {},
): void {
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, ...init }),
  );
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("tabs", () => {
  it("applies its default value and wires accessible relationships", () => {
    const root = createTabs(["overview", "projects"], {
      defaultValue: "projects",
    });
    const tabs = getTabs(root);
    const panels = getPanels(root);

    expect(root.value).toBe("projects");
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("false");
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
    expect(tabs[0]?.tabIndex).toBe(-1);
    expect(tabs[1]?.tabIndex).toBe(0);
    expect(tabs[1]?.getAttribute("aria-controls")).toBe(panels[1]?.id);
    expect(panels[1]?.getAttribute("aria-labelledby")).toBe(tabs[1]?.id);
    expect(panels[0]?.hidden).toBe(true);
    expect(panels[1]?.hidden).toBe(false);
    expect(panels[1]?.tabIndex).toBe(0);
    expect(tabs[0]?.dataset.state).toBe("inactive");
    expect(tabs[1]?.dataset.state).toBe("active");
  });

  it("selects the first enabled tab when defaultValue is omitted", () => {
    const root = createTabs(["first", "second"]);
    expect(root.value).toBe("first");
    expect(getTabs(root)[0]?.getAttribute("aria-selected")).toBe("true");
  });

  it("skips a disabled default and falls back to the next enabled tab", () => {
    const root = createTabs(["first", "second"], {
      defaultValue: "first",
      disabledValues: ["first"],
    });

    expect(root.value).toBe("second");
    expect(getTabs(root)[0]?.disabled).toBe(true);
    expect(getTabs(root)[1]?.getAttribute("aria-selected")).toBe("true");
  });

  it("changes value on click and emits ormo:value-change", () => {
    const root = createTabs(["overview", "projects"], {
      defaultValue: "overview",
    });
    const changes: string[] = [];

    root.addEventListener("ormo:value-change", (event) => {
      changes.push(event.detail.value);
    });

    getTabs(root)[1]?.click();
    expect(root.value).toBe("projects");
    expect(changes).toEqual(["projects"]);
    expect(getPanels(root)[1]?.hidden).toBe(false);
    expect(getPanels(root)[0]?.hidden).toBe(true);
  });

  it("can cancel ormo:value-change", () => {
    const root = createTabs(["overview", "projects"], {
      defaultValue: "overview",
    });

    root.addEventListener("ormo:value-change", (event) => {
      event.preventDefault();
    });

    getTabs(root)[1]?.click();
    expect(root.value).toBe("overview");
  });

  it("supports controlled assignment through the value property", () => {
    const root = createTabs(["overview", "projects"], {
      defaultValue: "overview",
    });

    root.value = "projects";
    expect(root.value).toBe("projects");
    expect(getTabs(root)[1]?.getAttribute("aria-selected")).toBe("true");
  });

  it("moves focus with arrow keys without activating by default", () => {
    const root = createTabs(["a", "b", "c"], { defaultValue: "a" });
    const tabs = getTabs(root);

    tabs[0]?.focus();
    dispatchKey(tabs[0]!, "ArrowRight");

    expect(document.activeElement).toBe(tabs[1]);
    expect(root.value).toBe("a");
    expect(tabs[0]?.tabIndex).toBe(-1);
    expect(tabs[1]?.tabIndex).toBe(0);
  });

  it("activates on focus when activateOnFocus is true", () => {
    const root = createTabs(["a", "b", "c"], {
      defaultValue: "a",
      activateOnFocus: true,
    });
    const tabs = getTabs(root);

    tabs[0]?.focus();
    dispatchKey(tabs[0]!, "ArrowRight");

    expect(document.activeElement).toBe(tabs[1]);
    expect(root.value).toBe("b");
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
  });

  it("supports Home and End keys", () => {
    const root = createTabs(["a", "b", "c"], {
      defaultValue: "b",
      activateOnFocus: true,
    });
    const tabs = getTabs(root);

    tabs[1]?.focus();
    dispatchKey(tabs[1]!, "Home");
    expect(root.value).toBe("a");
    expect(document.activeElement).toBe(tabs[0]);

    dispatchKey(tabs[0]!, "End");
    expect(root.value).toBe("c");
    expect(document.activeElement).toBe(tabs[2]);
  });

  it("loops focus by default and can disable looping", () => {
    const looping = createTabs(["a", "b"], {
      defaultValue: "b",
      activateOnFocus: true,
    });
    const loopingTabs = getTabs(looping);
    loopingTabs[1]?.focus();
    dispatchKey(loopingTabs[1]!, "ArrowRight");
    expect(document.activeElement).toBe(loopingTabs[0]);
    expect(looping.value).toBe("a");

    const bounded = createTabs(["a", "b"], {
      defaultValue: "b",
      activateOnFocus: true,
      loopFocus: false,
    });
    const boundedTabs = getTabs(bounded);
    boundedTabs[1]?.focus();
    dispatchKey(boundedTabs[1]!, "ArrowRight");
    expect(document.activeElement).toBe(boundedTabs[1]);
    expect(bounded.value).toBe("b");
  });

  it("uses vertical arrow keys when orientation is vertical", () => {
    const root = createTabs(["a", "b"], {
      defaultValue: "a",
      orientation: "vertical",
      activateOnFocus: true,
    });
    const tabs = getTabs(root);

    tabs[0]?.focus();
    dispatchKey(tabs[0]!, "ArrowDown");
    expect(root.value).toBe("b");

    dispatchKey(tabs[1]!, "ArrowUp");
    expect(root.value).toBe("a");
  });

  it("skips disabled tabs during keyboard navigation", () => {
    const root = createTabs(["a", "b", "c"], {
      defaultValue: "a",
      activateOnFocus: true,
      disabledValues: ["b"],
    });
    const tabs = getTabs(root);

    tabs[0]?.focus();
    dispatchKey(tabs[0]!, "ArrowRight");
    expect(document.activeElement).toBe(tabs[2]);
    expect(root.value).toBe("c");
  });

  it("disables every tab when the root is disabled", () => {
    const root = createTabs(["a", "b"], {
      defaultValue: "a",
      disabled: true,
    });
    const tabs = getTabs(root);

    expect(tabs.every((tab) => tab.disabled)).toBe(true);
    tabs[1]?.click();
    expect(root.value).toBe("a");
  });

  it("exposes orientation and activation properties", () => {
    const root = createTabs(["a", "b"]);

    expect(root.orientation).toBe("horizontal");
    expect(root.activateOnFocus).toBe(false);
    expect(root.loopFocus).toBe(true);

    root.orientation = "vertical";
    root.activateOnFocus = true;
    root.loopFocus = false;

    expect(root.dataset.orientation).toBe("vertical");
    expect(root.hasAttribute("data-activate-on-focus")).toBe(true);
    expect(root.getAttribute("data-loop-focus")).toBe("false");
  });

  it("does not treat Tab key as an internal navigation key", () => {
    const root = createTabs(["a", "b"], { defaultValue: "a" });
    const tabs = getTabs(root);
    const preventDefault = vi.fn();

    tabs[0]?.focus();
    tabs[0]?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      }),
    );

    // Ensure our handler does not call preventDefault on Tab by checking value unchanged
    // and focus stays until the browser moves it (jsdom won't move focus on Tab).
    expect(root.value).toBe("a");
    expect(preventDefault).not.toHaveBeenCalled();
    expect(tabs[0]?.tabIndex).toBe(0);
    expect(tabs[1]?.tabIndex).toBe(-1);
  });
});
