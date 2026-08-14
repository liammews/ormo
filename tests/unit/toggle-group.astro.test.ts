import { experimental_AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Default from "../fixtures/toggle-group/Default.astro";

describe("Toggle Group markup", () => {
  it("renders server state, semantics, and roving focus", async () => {
    const container = await experimental_AstroContainer.create();
    const html = await container.renderToString(Default);
    expect(html).toContain(
      '<ormo-toggle-group id="alignment" aria-label="Alignment" role="group"',
    );
    expect(html).toContain("data-required");
    expect(html).toContain('value="left"');
    expect(html).toContain('aria-pressed="true" tabindex="0"');
    expect(html).toContain(
      'value="centre" disabled aria-pressed="false" tabindex="-1"',
    );
  });
});
