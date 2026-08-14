import { experimental_AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Default from "../fixtures/toggle/Default.astro";

describe("Toggle markup", () => {
  it("renders native button state and attributes", async () => {
    const container = await experimental_AstroContainer.create();
    const html = await container.renderToString(Default);
    expect(html).toContain(
      '<button id="bold" name="format" value="bold" type="button" aria-pressed="true"',
    );
    expect(html).toContain('data-state="on"');
    expect(html).toContain('id="disabled-toggle"');
    expect(html).toContain(" disabled");
  });
});
