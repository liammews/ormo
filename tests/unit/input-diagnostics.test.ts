import { afterEach, describe, expect, it } from "vitest";

import { scanInputs } from "../../src/dev-toolbar/scan-inputs";

function render(markup: string): void {
  document.body.innerHTML = markup;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("Input development diagnostics", () => {
  it("accepts explicit and wrapping labels", () => {
    render(`
      <label for="email">Email address</label>
      <input id="email" data-ormo-input>
      <label>
        Search
        <input type="search" data-ormo-input>
      </label>
    `);

    expect(scanInputs()).toEqual([]);
  });

  it("accepts aria-label and aria-labelledby", () => {
    render(`
      <input data-ormo-input aria-label="Search">
      <span id="account-name">Account name</span>
      <input data-ormo-input aria-labelledby="account-name">
    `);

    expect(scanInputs()).toEqual([]);
  });

  it("does not treat a placeholder as an accessible name", () => {
    render(`<input data-ormo-input placeholder="Email address">`);

    expect(scanInputs()).toEqual([
      expect.objectContaining({
        message: "Input needs a visible label, aria-label, or aria-labelledby.",
      }),
    ]);
  });

  it("reports empty or broken accessible-name references", () => {
    render(`
      <label for="email"> </label>
      <input id="email" data-ormo-input aria-labelledby="missing">
    `);

    expect(scanInputs()).toEqual([
      expect.objectContaining({
        message: "Input needs a visible label, aria-label, or aria-labelledby.",
      }),
    ]);
  });
});
