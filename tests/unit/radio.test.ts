import { afterEach, describe, expect, it, vi } from "vitest";

import {
  initializeRadioRuntime,
  validateRadios,
} from "../../src/runtime/radio";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("radio", () => {
  it("accepts a wrapping label as an accessible name", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    document.body.innerHTML = `
      <label>
        <input type="radio" data-ormo-radio>
        Standard delivery
      </label>
    `;

    initializeRadioRuntime(document);
    validateRadios(document);

    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining("wrapping label"),
      expect.anything(),
    );
  });

  it("warns when a radio lacks an accessible name", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    document.body.innerHTML = `<input type="radio" data-ormo-radio>`;

    validateRadios(document);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("wrapping label"),
      expect.any(HTMLInputElement),
    );
  });

  it("warns when a styled radio is removed from interaction", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    document.body.innerHTML = `
      <input type="radio" data-ormo-radio aria-label="Standard" style="display: none">
    `;

    validateRadios(document);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("removed from interaction"),
      expect.any(HTMLInputElement),
    );
  });

  it("allows Astro development scripts between a radio and indicator", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    document.body.innerHTML = `
      <input type="radio" data-ormo-radio aria-label="Standard">
      <script></script>
      <span data-ormo-radio-indicator></span>
    `;

    validateRadios(document);

    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining("RadioIndicator"),
      expect.anything(),
    );
  });

  it("warns when an indicator does not follow a radio", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    document.body.innerHTML = `
      <input type="radio" data-ormo-radio aria-label="Standard">
      <div></div>
      <span data-ormo-radio-indicator></span>
    `;

    validateRadios(document);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("RadioIndicator"),
      expect.any(HTMLElement),
    );
  });
});
