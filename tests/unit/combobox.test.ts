import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrmoComboboxElement } from "../../src/components/combobox/types";
import { registerComboboxFloatingPositioner } from "../../src/runtime/combobox";

function createCombobox(): OrmoComboboxElement {
  const root = document.createElement("ormo-combobox") as OrmoComboboxElement;
  root.dataset.filter = "contains";
  root.innerHTML = `
    <select data-ormo-combobox-control name="country" required>
      <option value="">Search countries</option>
      <option value="fr" selected>France</option>
      <option value="gb">United Kingdom</option>
      <option value="us" disabled>United States</option>
    </select>
    <input type="text" role="combobox" aria-label="Country" data-ormo-combobox-input>
    <button type="button" aria-label="Show countries" data-ormo-combobox-toggle>⌄</button>
    <button type="button" aria-label="Clear country" data-ormo-combobox-clear>×</button>
    <div role="listbox" popover="auto" data-ormo-combobox-content>
      <div role="option" data-ormo-combobox-item data-value="fr" data-text-value="France" data-keywords="French Republic">France</div>
      <div role="option" data-ormo-combobox-item data-value="gb" data-text-value="United Kingdom" data-keywords="Britain\u001fUK">United Kingdom</div>
      <div role="option" data-ormo-combobox-item data-value="us" data-text-value="United States" data-disabled>United States</div>
      <div hidden data-ormo-combobox-empty>No countries found.</div>
    </div>
  `;
  document.body.append(root);
  return root;
}

function input(root: OrmoComboboxElement): HTMLInputElement {
  return root.querySelector("[data-ormo-combobox-input]")!;
}

function items(root: OrmoComboboxElement): HTMLElement[] {
  return Array.from(root.querySelectorAll("[data-ormo-combobox-item]"));
}

afterEach(() => {
  document.body.replaceChildren();
  delete (globalThis as { __ormoComboboxFloatingPositioner?: unknown })
    .__ormoComboboxFloatingPositioner;
});

describe("Combobox", () => {
  it("enhances the fallback and reflects the selected label", () => {
    const root = createCombobox();
    expect(root.hasAttribute("data-enhanced")).toBe(true);
    expect(root.value).toBe("fr");
    expect(root.inputValue).toBe("France");
    expect(input(root).getAttribute("aria-controls")).toBeTruthy();
    expect(items(root)[0]?.getAttribute("aria-selected")).toBe("true");
  });

  it("filters by labels and keywords while preserving typed text", () => {
    const root = createCombobox();
    const field = input(root);
    field.value = "brit";
    field.dispatchEvent(new Event("input", { bubbles: true }));

    expect(root.inputValue).toBe("brit");
    expect(root.value).toBe("fr");
    expect(items(root)[0]?.hidden).toBe(true);
    expect(items(root)[1]?.hidden).toBe(false);
    expect(items(root)[2]?.hidden).toBe(true);
    expect(root.open).toBe(true);
  });

  it("shows Empty when no item matches", () => {
    const root = createCombobox();
    const field = input(root);
    field.value = "zzzz";
    field.dispatchEvent(new Event("input", { bubbles: true }));

    expect(items(root).every((item) => item.hidden)).toBe(true);
    expect(
      root.querySelector<HTMLElement>("[data-ormo-combobox-empty]")?.hidden,
    ).toBe(false);
  });

  it("navigates filtered enabled items and commits a selection", () => {
    const root = createCombobox();
    const field = input(root);
    field.value = "united";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    field.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    expect(root.value).toBe("gb");
    expect(root.inputValue).toBe("United Kingdom");
    expect(root.open).toBe(false);
    expect(document.activeElement).toBe(field);
  });

  it("restores the committed value when Escape dismisses a search", () => {
    const root = createCombobox();
    const field = input(root);
    field.value = "can";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    expect(root.value).toBe("fr");
    expect(root.inputValue).toBe("France");
    expect(root.open).toBe(false);
  });

  it("supports cancellable item changes and emits native events", () => {
    const root = createCombobox();
    const control = root.querySelector<HTMLSelectElement>(
      "[data-ormo-combobox-control]",
    )!;
    const before = vi.fn((event: Event) => event.preventDefault());
    const change = vi.fn();
    root.addEventListener("ormo:combobox-before-value-change", before);
    control.addEventListener("change", change);

    items(root)[1]?.click();
    expect(root.value).toBe("fr");
    expect(change).not.toHaveBeenCalled();

    root.removeEventListener("ormo:combobox-before-value-change", before);
    items(root)[1]?.click();
    expect(root.value).toBe("gb");
    expect(change).toHaveBeenCalledOnce();
  });

  it("leaves committed and visible state unchanged when Clear is cancelled", () => {
    const root = createCombobox();
    const clear = root.querySelector<HTMLButtonElement>(
      "[data-ormo-combobox-clear]",
    )!;
    root.addEventListener("ormo:combobox-before-value-change", (event) => {
      event.preventDefault();
    });

    clear.click();

    expect(root.value).toBe("fr");
    expect(root.inputValue).toBe("France");
    expect(items(root)[0]?.hasAttribute("data-selected")).toBe(true);
    expect(clear.hidden).toBe(false);
  });

  it("clears value and input and participates in form reset", async () => {
    const root = createCombobox();
    const form = document.createElement("form");
    form.append(root);
    document.body.append(form);
    root
      .querySelector<HTMLButtonElement>("[data-ormo-combobox-clear]")
      ?.click();
    expect(root.value).toBe("");
    expect(root.inputValue).toBe("");

    root.value = "gb";
    form.reset();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(root.value).toBe("fr");
    expect(root.inputValue).toBe("France");
  });

  it("reflects disabled state and exposes programmatic APIs", () => {
    const root = createCombobox();
    root.disabled = true;
    root.show();
    expect(root.open).toBe(false);
    expect(input(root).disabled).toBe(true);

    root.disabled = false;
    root.value = "gb";
    root.show();
    expect(root.inputValue).toBe("United Kingdom");
    expect(root.open).toBe(true);
    root.toggle(false);
    expect(root.open).toBe(false);
  });

  it("synchronizes dynamically inserted items", async () => {
    const root = createCombobox();
    const item = document.createElement("div");
    item.setAttribute("role", "option");
    item.setAttribute("data-ormo-combobox-item", "");
    item.dataset.value = "ca";
    item.dataset.textValue = "Canada";
    item.textContent = "Canada";
    root.querySelector("[data-ormo-combobox-content]")?.append(item);
    await new Promise((resolve) => setTimeout(resolve, 0));
    root.value = "ca";
    expect(root.value).toBe("ca");
    expect(root.inputValue).toBe("Canada");
  });

  it("registers and cleans up a floating positioner", () => {
    const cleanup = vi.fn();
    const positioner = vi.fn(() => cleanup);
    registerComboboxFloatingPositioner(positioner);
    const root = createCombobox();
    root.dataset.positioning = "floating";
    const content = root.querySelector<HTMLElement>(
      "[data-ormo-combobox-content]",
    )!;

    root.show();

    expect(positioner).toHaveBeenCalledOnce();
    expect(positioner).toHaveBeenCalledWith(
      expect.objectContaining({
        root,
        trigger: input(root),
        content,
        side: "bottom",
        align: "start",
        sideOffset: 0,
      }),
    );
    expect(content.dataset.ormoComboboxPositioning).toBe("floating");

    root.hide();

    expect(cleanup).toHaveBeenCalledOnce();
    expect(content.hasAttribute("data-ormo-combobox-positioning")).toBe(false);
  });

  it("restores authored state and reconnects without duplicate events", () => {
    const root = createCombobox();
    const control = root.querySelector<HTMLSelectElement>(
      "[data-ormo-combobox-control]",
    )!;
    const field = input(root);
    const content = root.querySelector<HTMLElement>(
      "[data-ormo-combobox-content]",
    )!;
    const valueChange = vi.fn();

    root.remove();
    field.value = "Authored query";
    field.style.setProperty("anchor-name", "--authored-input", "important");
    content.style.setProperty("--ormo-combobox-anchor", "--authored-content");
    document.body.append(root);
    root.addEventListener("ormo:combobox-value-change", valueChange);
    root.value = "gb";
    root.show();

    (
      root as OrmoComboboxElement & { disconnectedCallback(): void }
    ).disconnectedCallback();

    expect(root.hasAttribute("data-enhanced")).toBe(false);
    expect(root.hasAttribute("data-open")).toBe(false);
    expect(control.hasAttribute("aria-hidden")).toBe(false);
    expect(control.hasAttribute("tabindex")).toBe(false);
    expect(field.getAttribute("aria-controls")).toBeNull();
    expect(field.value).toBe("Authored query");
    expect(field.style.getPropertyValue("anchor-name")).toBe(
      "--authored-input",
    );
    expect(field.style.getPropertyPriority("anchor-name")).toBe("important");
    expect(content.style.getPropertyValue("--ormo-combobox-anchor")).toBe(
      "--authored-content",
    );

    document.body.append(root);
    items(root)[0]?.click();
    expect(valueChange).toHaveBeenCalledTimes(2);
  });
});
