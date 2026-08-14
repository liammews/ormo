import { experimental_AstroContainer } from "astro/container";
import { expect, it } from "vitest";
import Default from "../fixtures/preview-card/Default.astro";

it("renders a link and visual-only preview with initial state", async () => {
  const container = await experimental_AstroContainer.create();
  const html = await container.renderToString(Default);
  expect(html).toContain("<ormo-preview-card");
  expect(html).toContain('href="/astro"');
  expect(html).toContain("data-ormo-preview-card-trigger");
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain('popover="manual"');
  expect(html).toContain('data-state="open"');
  expect(html).not.toContain('role="tooltip"');
});
