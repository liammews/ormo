import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AccordionType,
  AccordionValue,
  AccordionValueChangeEvent,
  OrmoAccordionElement,
} from "../../src/components/accordion/types";
import "../../src/runtime/accordion";

interface AccordionOptions {
  type?: AccordionType;
  collapsible?: boolean;
  defaultValue?: string | string[];
  disabledValues?: string[];
  disabled?: boolean;
  hiddenUntilFound?: boolean;
}

function createAccordion(
  values: string[],
  options: AccordionOptions = {},
): OrmoAccordionElement {
  const root = document.createElement("ormo-accordion");
  root.dataset.type = options.type ?? "single";
  root.dataset.orientation = "vertical";

  if (options.collapsible === false) {
    root.setAttribute("data-collapsible", "false");
  }

  if (options.defaultValue !== undefined) {
    root.dataset.defaultValue = JSON.stringify(options.defaultValue);
  }

  if (options.disabled) {
    root.setAttribute("data-disabled", "");
  }

  if (options.hiddenUntilFound) {
    root.setAttribute("data-hidden-until-found", "");
  }

  root.innerHTML = values
    .map(
      (value) => `
        <div
          data-ormo-accordion-item
          data-value="${value}"
          ${options.disabledValues?.includes(value) ? "data-item-disabled" : ""}
        >
          <h3 data-ormo-accordion-header>
            <button type="button" data-ormo-accordion-trigger>${value}</button>
          </h3>
          <div data-ormo-accordion-content>${value} content</div>
        </div>
      `,
    )
    .join("");

  document.body.append(root);
  return root;
}

function getItems(root: OrmoAccordionElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>("[data-ormo-accordion-item]"),
  );
}

function getTriggers(root: OrmoAccordionElement): HTMLButtonElement[] {
  return Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-ormo-accordion-trigger]"),
  );
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("accordion", () => {
  it("applies its default value and wires accessible relationships", () => {
    const root = createAccordion(["first", "second"], {
      defaultValue: "second",
    });
    const items = getItems(root);
    const triggers = getTriggers(root);
    const contents = Array.from(
      root.querySelectorAll<HTMLElement>("[data-ormo-accordion-content]"),
    );

    expect(root.value).toBe("second");
    expect(items[0]?.dataset.state).toBe("closed");
    expect(items[1]?.dataset.state).toBe("open");
    expect(items[0]?.dataset.index).toBe("0");
    expect(items[1]?.hasAttribute("data-open")).toBe(true);
    expect(triggers[1]?.getAttribute("aria-expanded")).toBe("true");
    expect(triggers[1]?.getAttribute("aria-controls")).toBe(contents[1]?.id);
    expect(contents[1]?.getAttribute("aria-labelledby")).toBe(triggers[1]?.id);
    expect(contents[1]?.hasAttribute("role")).toBe(false);
    expect(triggers[1]?.hasAttribute("aria-disabled")).toBe(false);
    expect(contents[0]?.hidden).toBe(true);
    expect(contents[0]?.getAttribute("aria-hidden")).toBe("true");
    expect(contents[0]?.hasAttribute("inert")).toBe(true);
    expect(contents[1]?.hidden).toBe(false);
    expect(contents[1]?.hasAttribute("aria-hidden")).toBe(false);
    expect(contents[1]?.hasAttribute("inert")).toBe(false);
    expect(
      contents[1]?.style.getPropertyValue("--ormo-accordion-content-height"),
    ).toBe("auto");
  });

  it("opens and collapses a single item", () => {
    const root = createAccordion(["first", "second"]);
    const trigger = getTriggers(root)[0];
    const changes: AccordionValue[] = [];

    root.addEventListener("ormo:value-change", (event) => {
      changes.push((event as AccordionValueChangeEvent).detail.value);
    });

    trigger?.click();
    expect(root.value).toBe("first");

    trigger?.click();
    expect(root.value).toBeNull();
    expect(changes).toEqual(["first", null]);
  });

  it("can require an open panel when collapsible is false", () => {
    const root = createAccordion(["first", "second"], {
      collapsible: false,
      defaultValue: "first",
    });
    const triggers = getTriggers(root);

    expect(root.collapsible).toBe(false);
    expect(triggers[0]?.getAttribute("aria-disabled")).toBe("true");

    triggers[0]?.click();
    expect(root.value).toBe("first");

    triggers[1]?.click();
    expect(root.value).toBe("second");
    expect(triggers[1]?.getAttribute("aria-disabled")).toBe("true");
  });

  it("refreshes trigger state when collapsible changes after connection", () => {
    const root = createAccordion(["first"], {
      collapsible: false,
      defaultValue: "first",
    });
    const trigger = getTriggers(root)[0];

    expect(root.collapsible).toBe(false);
    expect(trigger?.getAttribute("aria-disabled")).toBe("true");

    root.collapsible = true;

    expect(root.hasAttribute("data-collapsible")).toBe(false);
    expect(trigger?.hasAttribute("aria-disabled")).toBe(false);

    trigger?.click();
    expect(root.value).toBeNull();
  });

  it("exposes type on the browser element and remaps value when it changes", () => {
    const root = createAccordion(["first", "second"], {
      type: "multiple",
      defaultValue: ["first", "second"],
    });

    expect(root.type).toBe("multiple");
    expect(root.value).toEqual(["first", "second"]);

    root.type = "single";

    expect(root.type).toBe("single");
    expect(root.dataset.type).toBe("single");
    expect(root.value).toBe("first");
  });

  it("picks up authored trigger disabled changes after connection", () => {
    const root = createAccordion(["first", "second"]);
    const triggers = getTriggers(root);

    expect(triggers[0]?.disabled).toBe(false);

    if (triggers[0]) {
      triggers[0].disabled = true;
    }

    root.disabled = true;
    root.disabled = false;

    expect(triggers[0]?.disabled).toBe(true);
    expect(triggers[1]?.disabled).toBe(false);

    if (triggers[0]) {
      triggers[0].disabled = false;
    }

    root.disabled = true;
    root.disabled = false;

    expect(triggers[0]?.disabled).toBe(false);
  });

  it("supports multiple open items", () => {
    const root = createAccordion(["first", "second"], {
      type: "multiple",
      defaultValue: ["first"],
    });
    const triggers = getTriggers(root);
    const firstContent = root.querySelector<HTMLElement>(
      '[data-ormo-accordion-item][data-value="first"] [data-ormo-accordion-content]',
    );

    firstContent?.style.setProperty(
      "--ormo-accordion-content-height",
      "unchanged",
    );
    triggers[1]?.click();

    expect(root.value).toEqual(["first", "second"]);
    expect(
      firstContent?.style.getPropertyValue("--ormo-accordion-content-height"),
    ).toBe("unchanged");

    triggers[0]?.click();
    expect(root.value).toEqual(["second"]);
  });

  it("allows value changes to be canceled", () => {
    const root = createAccordion(["first"]);
    const listener = vi.fn((event: Event) => event.preventDefault());
    root.addEventListener("ormo:value-change", listener);

    getTriggers(root)[0]?.click();

    expect(listener).toHaveBeenCalledOnce();
    expect(root.value).toBeNull();
  });

  it("disables every trigger from the root and restores item state", () => {
    const root = createAccordion(["first", "second"], {
      disabled: true,
      disabledValues: ["second"],
    });
    const triggers = getTriggers(root);

    expect(root.disabled).toBe(true);
    expect(triggers.every((trigger) => trigger.disabled)).toBe(true);
    expect(
      getItems(root).every((item) => item.hasAttribute("data-disabled")),
    ).toBe(true);

    root.disabled = false;

    expect(triggers[0]?.disabled).toBe(false);
    expect(triggers[1]?.disabled).toBe(true);
    expect(getItems(root)[0]?.hasAttribute("data-disabled")).toBe(false);
    expect(getItems(root)[1]?.hasAttribute("data-disabled")).toBe(true);
  });

  it("does not let a canceled value event block a browser search match", () => {
    const root = createAccordion(["first", "second"], {
      hiddenUntilFound: true,
    });
    const listener = vi.fn((event: Event) => event.preventDefault());
    const content = root.querySelector<HTMLElement>(
      '[data-ormo-accordion-item][data-value="second"] [data-ormo-accordion-content]',
    );

    root.addEventListener("ormo:value-change", listener);
    expect(content?.getAttribute("hidden")).toBe("until-found");

    content?.dispatchEvent(new Event("beforematch", { bubbles: true }));

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0]?.[0].cancelable).toBe(false);
    expect(listener.mock.calls[0]?.[0].defaultPrevented).toBe(false);
    expect(root.value).toBe("second");
    expect(content?.hasAttribute("hidden")).toBe(false);
    expect(content?.hasAttribute("aria-hidden")).toBe(false);
    expect(content?.hasAttribute("inert")).toBe(false);
  });

  it("emits an item-level event after open state changes", () => {
    const root = createAccordion(["first"]);
    const changes: Array<{ open: boolean; value: string }> = [];

    root.addEventListener("ormo:open-change", (event) => {
      changes.push(
        (
          event as CustomEvent<{
            open: boolean;
            value: string;
          }>
        ).detail,
      );
    });

    getTriggers(root)[0]?.click();

    expect(changes).toEqual([{ open: true, value: "first" }]);
  });

  it("initializes items inserted after connection", async () => {
    const root = createAccordion(["first"]);
    const item = document.createElement("div");
    item.dataset.ormoAccordionItem = "";
    item.dataset.value = "second";
    item.innerHTML = `
      <h3 data-ormo-accordion-header>
        <button type="button" data-ormo-accordion-trigger>second</button>
      </h3>
      <div data-ormo-accordion-content>second content</div>
    `;

    root.append(item);
    await Promise.resolve();

    const trigger = item.querySelector<HTMLButtonElement>(
      "[data-ormo-accordion-trigger]",
    );
    const content = item.querySelector<HTMLElement>(
      "[data-ormo-accordion-content]",
    );

    expect(trigger?.getAttribute("aria-controls")).toBe(content?.id);
    expect(content?.getAttribute("aria-labelledby")).toBe(trigger?.id);
    expect(item.dataset.index).toBe("1");
  });

  it("keeps nested accordion interactions scoped to their own root", () => {
    const outer = createAccordion(["outer"], {
      defaultValue: "outer",
    });
    const outerContent = outer.querySelector<HTMLElement>(
      "[data-ormo-accordion-content]",
    );
    const inner = createAccordion(["inner"]);

    outerContent?.append(inner);
    getTriggers(inner)[0]?.click();

    expect(inner.value).toBe("inner");
    expect(outer.value).toBe("outer");
    expect(getTriggers(outer)[0]?.getAttribute("aria-expanded")).toBe("true");
  });

  it("moves focus to the trigger before closing focused content", () => {
    const root = createAccordion(["first"], {
      defaultValue: "first",
    });
    const trigger = getTriggers(root)[0];
    const content = root.querySelector<HTMLElement>(
      "[data-ormo-accordion-content]",
    );
    const input = document.createElement("input");

    content?.append(input);
    input.focus();
    root.value = null;

    expect(document.activeElement).toBe(trigger);
    expect(content?.hidden).toBe(true);
    expect(content?.hasAttribute("inert")).toBe(true);
  });

  it("leaves arrow, Home, and End keys to their native behavior", () => {
    const root = createAccordion(["first", "second", "third"], {
      disabledValues: ["second"],
    });
    const triggers = getTriggers(root);

    triggers[0]?.focus();
    triggers[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(document.activeElement).toBe(triggers[0]);

    triggers[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true }),
    );
    expect(document.activeElement).toBe(triggers[0]);
    expect(triggers[1]?.disabled).toBe(true);
  });
});
