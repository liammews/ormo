import { afterEach, describe, expect, it, vi } from "vitest";

import {
  initializeCheckboxRuntime,
  validateCheckboxes,
} from "../../src/runtime/checkbox";
import "../../src/runtime/checkbox";

function createCheckbox(attributes = ""): HTMLInputElement {
  document.body.innerHTML = `<input type="checkbox" data-ormo-checkbox ${attributes}>`;
  const checkbox = document.body.querySelector("input");
  if (!checkbox) {
    throw new Error("Expected checkbox");
  }
  initializeCheckboxRuntime(document);
  return checkbox;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("checkbox", () => {
  it("applies and consumes the initial indeterminate marker", () => {
    const checkbox = createCheckbox(
      'data-ormo-checkbox-initial-indeterminate aria-label="Mixed"',
    );
    expect(checkbox.indeterminate).toBe(true);
    expect(
      checkbox.hasAttribute("data-ormo-checkbox-initial-indeterminate"),
    ).toBe(false);
  });

  it("does not reapply an initial indeterminate state after interaction", () => {
    const checkbox = createCheckbox(
      'data-ormo-checkbox-initial-indeterminate aria-label="Mixed"',
    );

    checkbox.indeterminate = false;
    document.dispatchEvent(new Event("astro:page-load"));

    expect(checkbox.indeterminate).toBe(false);
  });

  it("warns when a checkbox has no accessible name", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    createCheckbox();
    validateCheckboxes(document);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("wrapping label"),
      expect.any(HTMLInputElement),
    );
  });

  it("accepts a wrapping label as an accessible name", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    document.body.innerHTML = `
      <label>
        <input type="checkbox" data-ormo-checkbox>
        Accept terms
      </label>
    `;
    initializeCheckboxRuntime(document);
    validateCheckboxes(document);
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining("wrapping label"),
      expect.anything(),
    );
  });

  it("warns when an indicator is not adjacent to a checkbox", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    document.body.innerHTML = `
      <input type="checkbox" data-ormo-checkbox aria-label="Terms">
      <div></div>
      <span data-ormo-checkbox-indicator></span>
    `;
    validateCheckboxes(document);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("CheckboxIndicator"),
      expect.any(HTMLElement),
    );
  });

  it("allows Astro development scripts between a checkbox and indicator", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    document.body.innerHTML = `
      <input type="checkbox" data-ormo-checkbox aria-label="Terms">
      <script></script>
      <span data-ormo-checkbox-indicator></span>
    `;
    validateCheckboxes(document);
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining("CheckboxIndicator"),
      expect.anything(),
    );
  });
});
