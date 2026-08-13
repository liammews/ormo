import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getTabbableElements,
  isProgrammaticallyFocusable,
  isTabbable,
  resolveFinalFocus,
} from "../../src/runtime/focus";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("focus utilities", () => {
  it("separates programmatically focusable elements from Tab stops", () => {
    const heading = document.createElement("h2");
    heading.tabIndex = -1;

    expect(isProgrammaticallyFocusable(heading)).toBe(true);
    expect(isTabbable(heading)).toBe(false);
  });

  it("excludes disabled, hidden, inert, and negative-tabindex controls", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <button data-control="enabled">Enabled</button>
      <button data-control="disabled" disabled>Disabled</button>
      <button data-control="negative" tabindex="-1">Programmatic</button>
      <div hidden><button data-control="hidden">Hidden</button></div>
      <div inert><button data-control="inert">Inert</button></div>
    `;
    document.body.append(root);

    expect(
      getTabbableElements(root).map((element) => element.dataset.control),
    ).toEqual(["enabled"]);
  });

  it("uses one Tab stop for each radio group", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <input type="radio" name="choice" data-control="first">
      <input type="radio" name="choice" data-control="selected" checked>
      <input type="radio" name="choice" data-control="last">
    `;
    document.body.append(root);

    expect(
      getTabbableElements(root).map((element) => element.dataset.control),
    ).toEqual(["selected"]);
  });

  it("resolves explicit, selected, and invoking final-focus targets", () => {
    const owner = document.createElement("div");
    const content = document.createElement("div");
    const explicitTarget = document.createElement("button");
    const selectedTarget = document.createElement("button");
    const invoker = document.createElement("button");
    selectedTarget.id = "after-popup";
    content.dataset.finalFocus = "#after-popup";
    document.body.append(
      owner,
      content,
      explicitTarget,
      selectedTarget,
      invoker,
    );

    expect(
      resolveFinalFocus({
        content,
        explicitTarget,
        invoker,
        owner,
        warningPrefix: "[Test]",
      }),
    ).toBe(explicitTarget);

    explicitTarget.remove();
    expect(
      resolveFinalFocus({
        content,
        explicitTarget,
        invoker,
        owner,
        warningPrefix: "[Test]",
      }),
    ).toBe(selectedTarget);

    content.removeAttribute("data-final-focus");
    expect(
      resolveFinalFocus({
        content,
        explicitTarget,
        invoker,
        owner,
        warningPrefix: "[Test]",
      }),
    ).toBe(invoker);
  });
});
