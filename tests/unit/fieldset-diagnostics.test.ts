import { afterEach, describe, expect, it } from "vitest";

import { scanFieldsets } from "../../src/dev-toolbar/scan-fieldsets";

function render(markup: string): void {
  document.body.innerHTML = markup;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("Fieldset development diagnostics", () => {
  it("accepts one named Legend as the first direct child", () => {
    render(`
      <fieldset data-ormo-fieldset-root>
        <legend data-ormo-fieldset-legend>Delivery address</legend>
        <input aria-label="Address">
      </fieldset>
    `);

    expect(scanFieldsets()).toEqual([]);
  });

  it("accepts native composition across the component boundary", () => {
    render(`
      <fieldset data-ormo-fieldset-root>
        <legend>Native legend</legend>
      </fieldset>
      <fieldset>
        <legend data-ormo-fieldset-legend>Component legend</legend>
      </fieldset>
    `);

    expect(scanFieldsets()).toEqual([]);
  });

  it("reports a missing Legend", () => {
    render(`
      <fieldset data-ormo-fieldset-root>
        <input aria-label="Address">
      </fieldset>
    `);

    expect(scanFieldsets()).toEqual([
      expect.objectContaining({
        message: "Fieldset Root needs one direct Legend as its first child.",
      }),
    ]);
  });

  it("reports a Legend that is not the first child", () => {
    render(`
      <fieldset data-ormo-fieldset-root>
        <p>Supporting text</p>
        <legend data-ormo-fieldset-legend>Delivery address</legend>
      </fieldset>
    `);

    expect(scanFieldsets()).toEqual([
      expect.objectContaining({
        message: "Fieldset Legend must be the first child of Fieldset Root.",
      }),
    ]);
  });

  it("reports multiple and empty direct Legends", () => {
    render(`
      <fieldset data-ormo-fieldset-root>
        <legend data-ormo-fieldset-legend> </legend>
        <legend data-ormo-fieldset-legend>Other label</legend>
      </fieldset>
    `);

    expect(scanFieldsets().map(({ message }) => message)).toEqual([
      "Fieldset Root must not contain more than one direct Legend.",
      "Fieldset Legend needs a non-empty accessible name.",
    ]);
  });

  it("reports a Legend outside a Fieldset Root", () => {
    render(`
      <fieldset data-ormo-fieldset-root>
        <div>
          <legend data-ormo-fieldset-legend>Delivery address</legend>
        </div>
      </fieldset>
    `);

    expect(scanFieldsets().map(({ message }) => message)).toEqual([
      "Fieldset Root needs one direct Legend as its first child.",
      "Fieldset Legend must be a direct child of a fieldset.",
    ]);
  });
});
