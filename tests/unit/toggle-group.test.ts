import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrmoToggleGroupElement } from "../../src/components/toggle-group/types";
import "../../src/runtime/toggle-group";
import { validateToggleGroup } from "../../src/runtime/toggle-group";

function group(
  options: {
    type?: "single" | "multiple";
    values?: string[];
    controlled?: boolean;
    disabled?: boolean;
    required?: boolean;
  } = {},
): OrmoToggleGroupElement {
  const root = document.createElement("ormo-toggle-group");
  root.dataset.type = options.type ?? "single";
  root.dataset.value = JSON.stringify(options.values ?? []);
  root.dataset.orientation = "horizontal";
  root.toggleAttribute("data-controlled", options.controlled ?? false);
  root.toggleAttribute("data-disabled", options.disabled ?? false);
  root.toggleAttribute("data-required", options.required ?? false);
  root.innerHTML = ["a", "b", "c"]
    .map(
      (value) =>
        `<button type="button" data-ormo-toggle data-ormo-toggle-group-item data-value="${value}" value="${value}">${value}</button>`,
    )
    .join("");
  document.body.append(root);
  return root;
}
function items(root: Element): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll("[data-ormo-toggle-group-item]"));
}
function key(item: HTMLElement, value: string): void {
  item.dispatchEvent(
    new KeyboardEvent("keydown", { key: value, bubbles: true }),
  );
}
async function mutations(): Promise<void> {
  await Promise.resolve();
}

afterEach(() => document.body.replaceChildren());

describe("Toggle Group runtime", () => {
  it("supports uncontrolled single, required, multiple, and cancellation", () => {
    const single = group({ values: ["a"], required: true });
    items(single)[0]!.click();
    expect(single.value).toBe("a");
    items(single)[1]!.click();
    expect(single.value).toBe("b");
    const multiple = group({ type: "multiple", values: ["a"] });
    items(multiple)[1]!.click();
    expect(multiple.value).toEqual(["a", "b"]);
    multiple.addEventListener("ormo:value-change", (event) =>
      event.preventDefault(),
    );
    items(multiple)[2]!.click();
    expect(multiple.value).toEqual(["a", "b"]);
  });

  it("waits for controlled assignment and emits previous value", () => {
    const root = group({ values: ["a"], controlled: true });
    const listener = vi.fn();
    root.addEventListener("ormo:value-change", listener);
    items(root)[1]!.click();
    expect(root.value).toBe("a");
    expect(listener.mock.calls[0]?.[0].detail).toEqual({
      value: "b",
      previousValue: "a",
      reason: "item",
    });
    root.value = "b";
    expect(items(root)[1]!.getAttribute("aria-pressed")).toBe("true");
  });

  it("uses shared roving focus with Tabs-compatible RTL keys", () => {
    const root = group();
    root.style.direction = "rtl";
    const buttons = items(root);
    buttons[0]!.focus();
    key(buttons[0]!, "ArrowLeft");
    expect(document.activeElement).toBe(buttons[1]);
    key(buttons[1]!, "Home");
    expect(document.activeElement).toBe(buttons[0]);
    root.orientation = "vertical";
    key(buttons[0]!, "ArrowDown");
    expect(document.activeElement).toBe(buttons[1]);
  });

  it("scopes nested groups and supports dynamic items and removal", async () => {
    const outer = group({ values: ["a"] });
    const inner = group({ values: ["a"] });
    outer.append(inner);
    items(inner)[1]!.click();
    expect(inner.value).toBe("b");
    expect(outer.value).toBe("a");
    const added = document.createElement("button");
    added.dataset.ormoToggleGroupItem = "";
    added.dataset.value = "d";
    outer.append(added);
    await mutations();
    expect(added.tabIndex).toBe(-1);
    items(outer)[0]!.remove();
    await mutations();
    expect(outer.value).toBe("");
    expect(items(outer).some((item) => item.tabIndex === 0)).toBe(true);
  });

  it("normalises required selection after removal", async () => {
    const root = group({ values: ["a"], required: true });
    const changes = vi.fn();
    root.addEventListener("ormo:value-change", changes);
    items(root)[0]!.remove();
    await mutations();
    expect(root.value).toBe("b");
    expect(changes.mock.calls[0]?.[0].detail).toEqual({
      value: "b",
      previousValue: "a",
      reason: "member-removed",
    });
  });

  it("responds to dynamic item disabled and value attributes", async () => {
    const root = group({ values: ["a"] });
    const buttons = items(root);
    buttons[1]!.disabled = true;
    await mutations();
    expect(buttons[1]!.hasAttribute("data-disabled")).toBe(true);
    buttons[1]!.disabled = false;
    buttons[1]!.value = "renamed";
    await mutations();
    expect(buttons[1]!.dataset.value).toBe("renamed");
    expect(buttons[1]!.hasAttribute("data-disabled")).toBe(false);
  });

  it("inherits disabled state and restores authored state on reconnect", () => {
    const root = group({ disabled: true });
    const button = items(root)[0]!;
    button.tabIndex = 3;
    root.remove();
    expect(button.disabled).toBe(false);
    expect(button.tabIndex).toBe(0);
    expect(button.hasAttribute("aria-pressed")).toBe(false);
    expect(button.hasAttribute("data-state")).toBe(false);
    root.removeAttribute("data-disabled");
    document.body.append(root);
    expect(button.disabled).toBe(false);
    root.disabled = true;
    expect(button.disabled).toBe(true);
    root.disabled = false;
    expect(button.disabled).toBe(false);
  });

  it("warns for invalid group structure", () => {
    const root = group();
    root.removeAttribute("aria-label");
    root.dataset.type = "invalid";
    items(root)[1]!.dataset.value = "a";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    validateToggleGroup(root);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("aria-label"),
      root,
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("type"), root);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("duplicated"),
      items(root)[1],
    );
  });
});
