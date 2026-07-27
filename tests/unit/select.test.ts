import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  OrmoSelectElement,
  SelectBeforeValueChangeEvent,
  SelectValueChangeEvent,
} from "../../src/components/select/types";
import "../../src/runtime/select";

function createSelect(): OrmoSelectElement {
  const root = document.createElement("ormo-select");
  root.innerHTML = `
    <select data-ormo-select-control name="country">
      <option value="">Choose a country</option>
      <optgroup label="Europe">
        <option value="gb">United Kingdom</option>
        <option value="fr">France</option>
      </optgroup>
      <option value="us" disabled>United States</option>
    </select>
    <button type="button" role="combobox" data-ormo-select-trigger>
      <span data-ormo-select-value>Choose a country</span>
    </button>
    <button type="button" aria-label="Clear country" data-ormo-select-clear>
      ×
    </button>
    <div role="listbox" popover="auto" data-ormo-select-content>
      <div role="option" data-ormo-select-item data-value="gb" data-text-value="United Kingdom">United Kingdom</div>
      <div role="option" data-ormo-select-item data-value="fr" data-text-value="France">France</div>
      <div role="separator" data-ormo-select-separator></div>
      <div role="option" data-ormo-select-item data-value="us" data-text-value="United States" data-disabled>United States</div>
    </div>
  `;
  document.body.append(root);
  return root;
}

function trigger(root: OrmoSelectElement): HTMLButtonElement {
  return root.querySelector("[data-ormo-select-trigger]")!;
}

function items(root: OrmoSelectElement): HTMLElement[] {
  return Array.from(root.querySelectorAll("[data-ormo-select-item]"));
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("Select", () => {
  it("enhances the native fallback and wires the combobox relationship", () => {
    const root = createSelect();
    const button = trigger(root);
    const content = root.querySelector<HTMLElement>(
      "[data-ormo-select-content]",
    )!;

    expect(root.hasAttribute("data-enhanced")).toBe(true);
    expect(button.getAttribute("aria-controls")).toBe(content.id);
    expect(content.getAttribute("aria-labelledby")).toBe(button.id);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(root.value).toBe("");
    expect(root.querySelector("[data-ormo-select-value]")?.textContent).toBe(
      "Choose a country",
    );
  });

  it("opens, navigates enabled items, and commits selection", () => {
    const root = createSelect();
    const button = trigger(root);

    button.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(root.open).toBe(true);
    expect(button.getAttribute("aria-activedescendant")).toBe(
      items(root)[0]?.id,
    );

    button.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    button.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    expect(root.value).toBe("fr");
    expect(root.open).toBe(false);
    expect(items(root)[1]?.getAttribute("aria-selected")).toBe("true");
    expect(root.querySelector("[data-ormo-select-value]")?.textContent).toBe(
      "France",
    );
  });

  it("skips disabled items during keyboard navigation", () => {
    const root = createSelect();
    root.value = "fr";
    const button = trigger(root);

    root.show();
    button.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );

    expect(button.getAttribute("aria-activedescendant")).toBe(
      items(root)[1]?.id,
    );
  });

  it("supports cancellable user value changes", () => {
    const root = createSelect();
    const before = vi.fn((event: Event) => event.preventDefault());
    const after = vi.fn();
    root.addEventListener("ormo:select-before-value-change", before);
    root.addEventListener("ormo:select-value-change", after);

    root.show();
    items(root)[0]?.click();

    expect(before).toHaveBeenCalledOnce();
    expect(
      (before.mock.calls[0]?.[0] as SelectBeforeValueChangeEvent).detail.value,
    ).toBe("gb");
    expect(root.value).toBe("");
    expect(after).not.toHaveBeenCalled();
  });

  it("emits native and Ormo events after a user selection", () => {
    const root = createSelect();
    const control = root.querySelector<HTMLSelectElement>(
      "[data-ormo-select-control]",
    )!;
    const input = vi.fn();
    const change = vi.fn();
    const valueChange = vi.fn();
    control.addEventListener("input", input);
    control.addEventListener("change", change);
    root.addEventListener("ormo:select-value-change", valueChange);

    root.show();
    items(root)[0]?.click();

    expect(input).toHaveBeenCalledOnce();
    expect(change).toHaveBeenCalledOnce();
    expect(valueChange).toHaveBeenCalledOnce();
    expect(
      (valueChange.mock.calls[0]?.[0] as SelectValueChangeEvent).detail,
    ).toMatchObject({ value: "gb", previousValue: "", reason: "item" });
  });

  it("clears an optional value and restores its placeholder", () => {
    const root = createSelect();
    root.value = "fr";
    const clear = root.querySelector<HTMLButtonElement>(
      "[data-ormo-select-clear]",
    )!;

    clear.click();

    expect(root.value).toBe("");
    expect(clear.disabled).toBe(true);
    expect(root.querySelector("[data-ormo-select-value]")?.textContent).toBe(
      "Choose a country",
    );
  });

  it("supports typeahead while closed", () => {
    const root = createSelect();
    trigger(root).dispatchEvent(
      new KeyboardEvent("keydown", { key: "f", bubbles: true }),
    );

    expect(root.value).toBe("fr");
    expect(root.open).toBe(false);
  });

  it("synchronizes dynamically inserted items with the native control", async () => {
    const root = createSelect();
    const item = document.createElement("div");
    item.setAttribute("role", "option");
    item.setAttribute("data-ormo-select-item", "");
    item.dataset.value = "de";
    item.dataset.textValue = "Germany";
    item.textContent = "Germany";
    root.querySelector("[data-ormo-select-content]")?.append(item);

    await new Promise((resolve) => setTimeout(resolve, 0));
    root.value = "de";

    expect(root.value).toBe("de");
    expect(
      root.querySelector<HTMLSelectElement>("[data-ormo-select-control]")
        ?.selectedOptions[0]?.text,
    ).toBe("Germany");
  });
});
