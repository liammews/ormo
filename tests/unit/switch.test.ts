import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrmoSwitchElement } from "../../src/components/switch/types";
import "../../src/runtime/switch";

function createSwitch(): OrmoSwitchElement {
  const root = document.createElement("ormo-switch") as OrmoSwitchElement;
  root.innerHTML = `
    <input type="checkbox" role="switch" name="setting" value="yes" aria-label="Setting" data-ormo-switch-input>
    <span aria-hidden="true" data-ormo-switch-thumb></span>
  `;
  document.body.append(root);
  return root;
}

afterEach(() => document.body.replaceChildren());

describe("Switch", () => {
  it("synchronises checked state and emits user changes", () => {
    const root = createSwitch();
    const change = vi.fn();
    root.addEventListener("ormo:switch-checked-change", change);
    root.querySelector<HTMLInputElement>("input")?.click();
    expect(root.checked).toBe(true);
    expect(root.dataset.state).toBe("checked");
    expect(change).toHaveBeenCalledOnce();
    expect(change.mock.calls[0]?.[0].detail).toEqual({
      checked: true,
      previousChecked: false,
      reason: "user",
    });
  });

  it("supports cancellable user changes", () => {
    const root = createSwitch();
    root.addEventListener("ormo:switch-before-checked-change", (event) =>
      event.preventDefault(),
    );
    root.querySelector<HTMLInputElement>("input")?.click();
    expect(root.checked).toBe(false);
  });

  it("blocks readonly interaction but remains focusable", () => {
    const root = createSwitch();
    root.readOnly = true;
    const input = root.querySelector<HTMLInputElement>("input")!;
    input.click();
    expect(root.checked).toBe(false);
    expect(input.disabled).toBe(false);
    expect(root.hasAttribute("data-readonly")).toBe(true);
    expect(input.getAttribute("aria-readonly")).toBe("true");
  });

  it("restores readonly state without native click rollback", async () => {
    const root = createSwitch();
    root.readOnly = true;
    const input = root.querySelector<HTMLInputElement>("input")!;
    input.addEventListener("click", () => {
      input.checked = true;
    });
    input.click();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(root.checked).toBe(false);
    expect(root.dataset.state).toBe("unchecked");
  });

  it("initialises replaced parts and ignores nested switch parts", async () => {
    const root = createSwitch();
    const nested = document.createElement("ormo-switch");
    nested.innerHTML = `
      <input type="checkbox" aria-label="Nested" data-ormo-switch-input>
      <span data-ormo-switch-thumb></span>
    `;
    root.append(nested);
    const replacement = document.createElement("span");
    replacement.setAttribute("data-ormo-switch-thumb", "");
    root
      .querySelector(":scope > [data-ormo-switch-thumb]")
      ?.replaceWith(replacement);
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    root.checked = true;
    expect(replacement.dataset.state).toBe("checked");
    expect(nested.querySelector("span")?.dataset.state).toBe("unchecked");
  });

  it("follows a form owner established after connection", async () => {
    const root = createSwitch();
    const input = root.querySelector<HTMLInputElement>("input")!;
    input.setAttribute("form", "settings");
    input.defaultChecked = true;
    input.checked = false;
    const form = document.createElement("form");
    form.id = "settings";
    document.body.append(form);
    form.reset();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(root.checked).toBe(true);
    expect(root.dataset.state).toBe("checked");
  });

  it("exposes programmatic state, form properties, and validity", () => {
    const form = document.createElement("form");
    const root = createSwitch();
    form.append(root);
    document.body.append(form);
    const change = vi.fn();
    root.addEventListener("ormo:switch-checked-change", change);
    root.required = true;
    expect(root.valid).toBe(false);
    root.checked = true;
    expect(root.valid).toBe(true);
    expect(root.form).toBe(form);
    expect(new FormData(form).get("setting")).toBe("yes");
    expect(change.mock.calls[0]?.[0].detail.reason).toBe("programmatic");
  });

  it("restores default state on form reset", async () => {
    const form = document.createElement("form");
    const root = createSwitch();
    const input = root.querySelector<HTMLInputElement>("input")!;
    input.defaultChecked = true;
    input.checked = true;
    form.append(root);
    document.body.append(form);
    root.checked = false;
    form.reset();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(root.checked).toBe(true);
    expect(root.dataset.state).toBe("checked");
  });

  it("reconnects without duplicate events and restores authored hooks", () => {
    const root = createSwitch();
    const input = root.querySelector<HTMLInputElement>("input")!;
    const change = vi.fn();
    root.addEventListener("ormo:switch-checked-change", change);
    root.remove();
    expect(root.hasAttribute("data-enhanced")).toBe(false);
    document.body.append(root);
    input.click();
    expect(change).toHaveBeenCalledOnce();
  });
});
