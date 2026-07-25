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
  it("applies indeterminate from data-indeterminate", () => {
    const checkbox = createCheckbox('data-indeterminate aria-label="Mixed"');
    expect(checkbox.indeterminate).toBe(true);
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
});
