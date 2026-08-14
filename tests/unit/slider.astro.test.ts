import { experimental_AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Default from "../fixtures/slider/Default.astro";

describe("Slider markup", () => {
  it("renders native range inputs and initial geometry", async () => {
    const container = await experimental_AstroContainer.create();
    const html = await container.renderToString(Default);

    expect(html).toContain("<ormo-slider");
    expect(html).toContain('role="group"');
    expect(html).toContain('data-value="[20,80]"');
    expect(html).toContain("--ormo-slider-start: 20%");
    expect(html).toContain("--ormo-slider-end: 80%");
    expect(html.match(/type="range"/g)).toHaveLength(2);
    expect(html).toContain('value="20" min="0" max="100" step="5"');
    expect(html).toContain('value="80" min="0" max="100" step="5"');
    expect(html.match(/name="price"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Minimum price"');
    expect(html).toContain('aria-label="Maximum price"');
    expect(html).toContain("data-ormo-slider-track");
    expect(html).toContain("data-ormo-slider-range");
  });
});
