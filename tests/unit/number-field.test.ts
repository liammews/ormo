import { afterEach, describe, expect, it } from "vitest";
import type { OrmoNumberFieldElement } from "../../src/components/number-field/types";
import "../../src/runtime/number-field";

afterEach(() => document.body.replaceChildren());

function setup(attributes = ""): OrmoNumberFieldElement {
  const root = document.createElement("ormo-number-field");
  root.setAttribute("data-value", "1");
  root.setAttribute("data-default-value", "1");
  root.setAttribute("data-min", "0");
  root.setAttribute("data-max", "2");
  root.setAttribute("data-step", "0.1");
  for (const [name, value] of Object.entries(
    Object.fromEntries(new URLSearchParams(attributes)),
  ))
    root.setAttribute(name, value);
  root.innerHTML = `
    <button data-ormo-number-field-decrement>−</button>
    <input type="number" aria-label="Amount" data-ormo-number-field-input>
    <button data-ormo-number-field-increment>+</button>`;
  document.body.append(root);
  return root;
}

describe("Number Field", () => {
  it("increments and decrements without floating-point drift", () => {
    const root = setup();
    root
      .querySelector<HTMLElement>("[data-ormo-number-field-increment]")!
      .click();
    expect(root.value).toBe(1.1);
    root
      .querySelector<HTMLElement>("[data-ormo-number-field-decrement]")!
      .click();
    expect(root.value).toBe(1);
  });

  it("supports small and large modifier steps", () => {
    const root = setup();
    root.dataset.smallStep = "0.01";
    root.dataset.largeStep = "0.5";
    const increment = root.querySelector<HTMLElement>(
      "[data-ormo-number-field-increment]",
    )!;
    increment.dispatchEvent(
      new MouseEvent("click", { altKey: true, bubbles: true }),
    );
    expect(root.value).toBe(1.01);
    increment.dispatchEvent(
      new MouseEvent("click", { shiftKey: true, bubbles: true }),
    );
    expect(root.value).toBe(1.51);
  });

  it("clamps step interactions and disables controls at boundaries", () => {
    const root = setup();
    root.value = 2;
    expect(
      root.querySelector<HTMLButtonElement>(
        "[data-ormo-number-field-increment]",
      )!.disabled,
    ).toBe(true);
    root.increment();
    expect(root.value).toBe(2);
    root.value = 0;
    expect(
      root.querySelector<HTMLButtonElement>(
        "[data-ormo-number-field-decrement]",
      )!.disabled,
    ).toBe(true);
  });

  it("accepts empty and out-of-range native input for validation", () => {
    const root = setup();
    const input = root.querySelector<HTMLInputElement>("input")!;
    input.value = "";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(root.value).toBeNull();
    input.value = "3";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(root.value).toBe(3);
    expect(input.validity.rangeOverflow).toBe(true);
  });

  it("supports controlled and cancelled change requests", () => {
    const root = setup("data-controlled=");
    const increment = root.querySelector<HTMLElement>(
      "[data-ormo-number-field-increment]",
    )!;
    increment.click();
    expect(root.value).toBe(1);
    root.removeAttribute("data-controlled");
    root.addEventListener("ormo:number-field-value-change", (event) =>
      event.preventDefault(),
    );
    increment.click();
    expect(root.value).toBe(1);
  });

  it("reports reasoned changes", () => {
    const root = setup();
    const reasons: string[] = [];
    root.addEventListener("ormo:number-field-value-change", (event) =>
      reasons.push(event.detail.reason),
    );
    root.increment();
    root.decrement();
    root.value = 1.5;
    expect(reasons).toEqual(["increment", "decrement", "programmatic"]);
  });

  it("resets to the server-rendered default", async () => {
    const form = document.createElement("form");
    const root = setup();
    form.append(root);
    document.body.append(form);
    root.value = 1.7;
    form.dispatchEvent(new Event("reset"));
    await Promise.resolve();
    expect(root.value).toBe(1);
  });

  it("starts bounded stepping at the nearest boundary from empty", () => {
    const root = setup();
    root.value = null;
    root.min = 5;
    root.max = 10;
    root.increment();
    expect(root.value).toBe(5);
    root.value = null;
    root.decrement();
    expect(root.value).toBe(10);
  });

  it("supports opt-in wheel stepping only while focused", () => {
    const root = setup("data-allow-wheel-step=");
    const input = root.querySelector<HTMLInputElement>("input")!;
    input.focus();
    input.dispatchEvent(
      new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -1 }),
    );
    expect(root.value).toBe(1.1);
  });

  it("releases replaced inputs before managing their replacement", async () => {
    const root = setup();
    const original = root.querySelector<HTMLInputElement>("input")!;
    const replacement = document.createElement("input");
    replacement.type = "number";
    replacement.dataset.ormoNumberFieldInput = "";
    replacement.setAttribute("aria-label", "Replacement");
    original.replaceWith(replacement);
    await Promise.resolve();
    expect(original.value).toBe("");
    expect(original.hasAttribute("min")).toBe(false);
    expect(replacement.value).toBe("1");
    expect(replacement.min).toBe("0");
  });

  it("restores authored input and button state after disconnect", () => {
    const root = setup();
    const input = root.querySelector<HTMLInputElement>("input")!;
    const increment = root.querySelector<HTMLButtonElement>(
      "[data-ormo-number-field-increment]",
    )!;
    root.disabled = true;
    expect(input.disabled).toBe(true);
    expect(increment.disabled).toBe(true);
    root.remove();
    expect(input.disabled).toBe(false);
    expect(increment.disabled).toBe(false);
    expect(input.value).toBe("");
    expect(input.hasAttribute("min")).toBe(false);
  });
});
