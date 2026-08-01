import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrmoAutocompleteElement } from "../../src/components/autocomplete/types";
import { registerAutocompleteFloatingPositioner } from "../../src/runtime/autocomplete";

function createAutocomplete(): OrmoAutocompleteElement {
  const root = document.createElement(
    "ormo-autocomplete",
  ) as OrmoAutocompleteElement;
  root.dataset.filter = "contains";
  root.dataset.minLength = "1";
  root.innerHTML = `
    <input name="location" value="Lon" role="combobox" aria-label="Location" data-ormo-autocomplete-input>
    <button type="button" data-ormo-autocomplete-clear aria-label="Clear location">×</button>
    <div role="listbox" popover="auto" data-ormo-autocomplete-content>
      <div role="option" data-ormo-autocomplete-item data-value="London" data-identifier="london" data-text-value="London" data-keywords="LDN">London</div>
      <div role="option" data-ormo-autocomplete-item data-value="Paris" data-identifier="paris" data-text-value="Paris">Paris</div>
      <div role="option" data-ormo-autocomplete-item data-value="Prague" data-disabled data-text-value="Prague">Prague</div>
      <div hidden data-ormo-autocomplete-loading>Loading…</div>
      <div hidden data-ormo-autocomplete-empty>No results.</div>
    </div>`;
  document.body.append(root);
  return root;
}
const input = (root: OrmoAutocompleteElement) =>
  root.querySelector<HTMLInputElement>("[data-ormo-autocomplete-input]")!;
const items = (root: OrmoAutocompleteElement) =>
  Array.from(
    root.querySelectorAll<HTMLElement>("[data-ormo-autocomplete-item]"),
  );

afterEach(() => {
  document.body.replaceChildren();
  delete (globalThis as { __ormoAutocompleteFloatingPositioner?: unknown })
    .__ormoAutocompleteFloatingPositioner;
});

describe("Autocomplete", () => {
  it("enhances the native input and filters labels and aliases", () => {
    const root = createAutocomplete();
    expect(root.value).toBe("Lon");
    const field = input(root);
    field.value = "ldn";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    expect(root.value).toBe("ldn");
    expect(items(root)[0]?.hidden).toBe(false);
    expect(items(root)[1]?.hidden).toBe(true);
    expect(root.open).toBe(true);
  });

  it("keeps unmatched freeform text and dismisses without reverting it", () => {
    const root = createAutocomplete();
    const field = input(root);
    field.value = "Somewhere new";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(root.value).toBe("Somewhere new");
    expect(root.open).toBe(false);
  });

  it("selects a suggestion and emits its identifier", () => {
    const root = createAutocomplete();
    const selected = vi.fn();
    root.addEventListener("ormo:autocomplete-select", selected);
    items(root)[0]?.click();
    expect(root.value).toBe("London");
    expect(selected).toHaveBeenCalledOnce();
    expect(selected.mock.calls[0]?.[0].detail).toEqual({
      value: "London",
      identifier: "london",
    });
  });

  it("supports loading, empty, and minimum query states", () => {
    const root = createAutocomplete();
    root.loading = true;
    expect(
      root.querySelector<HTMLElement>("[data-ormo-autocomplete-loading]")
        ?.hidden,
    ).toBe(false);
    expect(
      root.querySelector<HTMLElement>("[data-ormo-autocomplete-empty]")?.hidden,
    ).toBe(true);
    root.loading = false;
    root.value = "zzz";
    expect(
      root.querySelector<HTMLElement>("[data-ormo-autocomplete-empty]")?.hidden,
    ).toBe(false);
  });

  it("closes atomically and blocks pointer selection when disabled", () => {
    const root = createAutocomplete();
    root.show();
    expect(root.open).toBe(true);
    root.disabled = true;
    expect(root.open).toBe(false);
    expect(input(root).disabled).toBe(true);
    items(root)[1]?.click();
    expect(root.value).toBe("Lon");
  });

  it("treats readonly as a composed non-mutating state", () => {
    const root = createAutocomplete();
    root.readOnly = true;
    expect(input(root).readOnly).toBe(true);
    root.show();
    expect(root.open).toBe(false);
    items(root)[1]?.click();
    root
      .querySelector<HTMLButtonElement>("[data-ormo-autocomplete-clear]")
      ?.click();
    expect(root.value).toBe("Lon");
    root.readOnly = false;
    expect(input(root).readOnly).toBe(false);
  });

  it("clears an active descendant removed by async result replacement", async () => {
    const root = createAutocomplete();
    const field = input(root);
    root.show();
    field.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    const activeId = field.getAttribute("aria-activedescendant");
    expect(activeId).toBeTruthy();
    root.querySelector(`#${activeId}`)?.remove();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(field.hasAttribute("aria-activedescendant")).toBe(false);
    field.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(root.value).toBe("Lon");
  });

  it("waits for IME composition to commit before filtering and emitting", () => {
    const root = createAutocomplete();
    const field = input(root);
    const changes = vi.fn();
    root.addEventListener("ormo:autocomplete-value-change", changes);
    field.dispatchEvent(new CompositionEvent("compositionstart"));
    field.value = "東京";
    field.dispatchEvent(
      new InputEvent("input", { bubbles: true, isComposing: true }),
    );
    field.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        isComposing: true,
      }),
    );
    expect(changes).not.toHaveBeenCalled();
    expect(root.open).toBe(false);
    field.dispatchEvent(new CompositionEvent("compositionend"));
    expect(changes).toHaveBeenCalledOnce();
    expect(root.value).toBe("東京");
    expect(root.open).toBe(true);
  });

  it("makes input, item, and Clear cancellation atomic", () => {
    const root = createAutocomplete();
    root.addEventListener("ormo:autocomplete-before-value-change", (event) =>
      event.preventDefault(),
    );
    const field = input(root);
    field.value = "Blocked";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    expect(root.value).toBe("Lon");
    items(root)[1]?.click();
    expect(root.value).toBe("Lon");
    root
      .querySelector<HTMLButtonElement>("[data-ormo-autocomplete-clear]")
      ?.click();
    expect(root.value).toBe("Lon");
  });

  it("participates in native form reset", async () => {
    const root = createAutocomplete();
    const form = document.createElement("form");
    form.append(root);
    document.body.append(form);
    root.value = "Paris";
    form.reset();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(root.value).toBe("Lon");
  });

  it("registers and cleans up a floating positioner", () => {
    const cleanup = vi.fn();
    const positioner = vi.fn(() => cleanup);
    registerAutocompleteFloatingPositioner(positioner);
    const root = createAutocomplete();
    root.dataset.positioning = "floating";
    root.show();
    expect(positioner).toHaveBeenCalledOnce();
    root.hide();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("restores authored state and reconnects without duplicate events", () => {
    const root = createAutocomplete();
    const field = input(root);
    const changes = vi.fn();
    root.remove();
    field.value = "Authored";
    field.style.setProperty("anchor-name", "--authored", "important");
    document.body.append(root);
    root.addEventListener("ormo:autocomplete-value-change", changes);
    root.value = "Paris";
    root.remove();
    expect(root.hasAttribute("data-enhanced")).toBe(false);
    expect(field.value).toBe("Authored");
    expect(field.style.getPropertyValue("anchor-name")).toBe("--authored");
    changes.mockClear();
    document.body.append(root);
    root.value = "L";
    items(root)[0]?.click();
    expect(changes).toHaveBeenCalledTimes(2);
  });
});
