import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AccordionType,
  AccordionValue,
  AccordionValueChangeEvent,
  GoodUIAccordionElement,
} from "../../src/components/accordion/types";
import "../../src/runtime/accordion";

interface AccordionOptions {
  type?: AccordionType;
  collapsible?: boolean;
  defaultValue?: string | string[];
  disabledValues?: string[];
}

function createAccordion(
  values: string[],
  options: AccordionOptions = {},
): GoodUIAccordionElement {
  const root = document.createElement("goodui-accordion");
  root.dataset.type = options.type ?? "single";
  root.dataset.orientation = "vertical";

  if (options.collapsible) {
    root.setAttribute("data-collapsible", "");
  }

  if (options.defaultValue !== undefined) {
    root.dataset.defaultValue = JSON.stringify(options.defaultValue);
  }

  root.innerHTML = values
    .map(
      (value) => `
        <div
          data-goodui-accordion-item
          data-value="${value}"
          ${options.disabledValues?.includes(value) ? "data-disabled" : ""}
        >
          <h3 data-goodui-accordion-header>
            <button type="button" data-goodui-accordion-trigger>${value}</button>
          </h3>
          <div data-goodui-accordion-content>${value} content</div>
        </div>
      `,
    )
    .join("");

  document.body.append(root);
  return root;
}

function getItems(root: GoodUIAccordionElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>("[data-goodui-accordion-item]"),
  );
}

function getTriggers(root: GoodUIAccordionElement): HTMLButtonElement[] {
  return Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-goodui-accordion-trigger]"),
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
      root.querySelectorAll<HTMLElement>("[data-goodui-accordion-content]"),
    );

    expect(root.value).toBe("second");
    expect(items[0]?.dataset.state).toBe("closed");
    expect(items[1]?.dataset.state).toBe("open");
    expect(triggers[1]?.getAttribute("aria-expanded")).toBe("true");
    expect(triggers[1]?.getAttribute("aria-controls")).toBe(contents[1]?.id);
    expect(contents[1]?.getAttribute("aria-labelledby")).toBe(triggers[1]?.id);
    expect(contents[1]?.getAttribute("role")).toBe("region");
    expect(contents[0]?.hidden).toBe(true);
    expect(contents[0]?.getAttribute("aria-hidden")).toBe("true");
    expect(contents[0]?.hasAttribute("inert")).toBe(true);
    expect(contents[1]?.hidden).toBe(false);
    expect(contents[1]?.hasAttribute("aria-hidden")).toBe(false);
    expect(contents[1]?.hasAttribute("inert")).toBe(false);
    expect(
      contents[1]?.style.getPropertyValue("--goodui-accordion-content-height"),
    ).toBe("auto");
  });

  it("opens and collapses a single item", () => {
    const root = createAccordion(["first", "second"], {
      collapsible: true,
    });
    const trigger = getTriggers(root)[0];
    const changes: AccordionValue[] = [];

    root.addEventListener("goodui:value-change", (event) => {
      changes.push((event as AccordionValueChangeEvent).detail.value);
    });

    trigger?.click();
    expect(root.value).toBe("first");

    trigger?.click();
    expect(root.value).toBeNull();
    expect(changes).toEqual(["first", null]);
  });

  it("supports multiple open items", () => {
    const root = createAccordion(["first", "second"], {
      type: "multiple",
      defaultValue: ["first"],
    });
    const triggers = getTriggers(root);
    const firstContent = root.querySelector<HTMLElement>(
      '[data-goodui-accordion-item][data-value="first"] [data-goodui-accordion-content]',
    );

    firstContent?.style.setProperty(
      "--goodui-accordion-content-height",
      "unchanged",
    );
    triggers[1]?.click();

    expect(root.value).toEqual(["first", "second"]);
    expect(
      firstContent?.style.getPropertyValue("--goodui-accordion-content-height"),
    ).toBe("unchanged");

    triggers[0]?.click();
    expect(root.value).toEqual(["second"]);
  });

  it("allows value changes to be canceled", () => {
    const root = createAccordion(["first"]);
    const listener = vi.fn((event: Event) => event.preventDefault());
    root.addEventListener("goodui:value-change", listener);

    getTriggers(root)[0]?.click();

    expect(listener).toHaveBeenCalledOnce();
    expect(root.value).toBeNull();
  });

  it("moves focus with arrow, Home, and End keys while skipping disabled items", () => {
    const root = createAccordion(["first", "second", "third"], {
      disabledValues: ["second"],
    });
    const triggers = getTriggers(root);

    triggers[0]?.focus();
    triggers[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(document.activeElement).toBe(triggers[2]);

    triggers[2]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(document.activeElement).toBe(triggers[0]);

    triggers[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true }),
    );
    expect(document.activeElement).toBe(triggers[2]);

    triggers[2]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
    );
    expect(document.activeElement).toBe(triggers[0]);
    expect(triggers[1]?.disabled).toBe(true);
  });
});
