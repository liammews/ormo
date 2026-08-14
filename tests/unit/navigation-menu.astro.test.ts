import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Basic from "../fixtures/navigation-menu/Basic.astro";

describe("Navigation Menu SSR", () => {
  it("renders navigation, links and initial disclosure state", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Basic);
    expect(html).toContain('<nav aria-label="Main">');
    expect(html).toContain('href="/"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('data-state="open"');
    expect(html).toContain('data-positioning="floating"');
    expect(html).toContain('data-side="top"');
    expect(html).toContain('data-align="end"');
    expect(html).toContain("--ormo-navigation-menu-side-offset: 8px");
    expect(html).not.toContain("data-ormo-navigation-menu-content hidden");
  });
});
