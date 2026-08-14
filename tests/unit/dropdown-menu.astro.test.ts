import { experimental_AstroContainer } from "astro/container";
import { expect, it } from "vitest";

import Default from "../fixtures/dropdown-menu/Default.astro";

it("renders the menu button pattern and initial state", async () => {
  const container = await experimental_AstroContainer.create();
  const html = await container.renderToString(Default);
  expect(html).toContain("<ormo-dropdown-menu");
  expect(html).toContain('aria-haspopup="menu"');
  expect(html).toContain('aria-expanded="true"');
  expect(html).toContain('aria-controls="actions-content"');
  expect(html).toContain('role="menu"');
  expect(html).toContain('role="menuitem"');
  expect(html).toContain('aria-disabled="true"');
  expect(html).toContain('role="separator"');
  expect(html).toContain('role="menuitemcheckbox"');
  expect(html).toContain('aria-checked="true"');
  expect(html).toContain('role="menuitemradio"');
  expect(html).toContain('data-value="dark"');
  expect(html).toContain("data-submenu");
  expect(html).toContain('aria-haspopup="menu"');
  expect(html).toContain('href="/help"');
});
