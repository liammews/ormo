import { experimental_AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";

import Default from "../fixtures/popover/Default.astro";
import { findOpeningTag } from "./helpers/astro";

describe("Popover markup", () => {
  let container: Awaited<ReturnType<typeof experimental_AstroContainer.create>>;

  beforeAll(async () => {
    container = await experimental_AstroContainer.create();
  });

  it("renders a closed labelled popover contract", async () => {
    const html = await container.renderToString(Default);
    const root = findOpeningTag(html, "ormo-popover", 'id="filters"');
    const trigger = findOpeningTag(html, "button", 'class="trigger"');
    const content = findOpeningTag(html, "div", 'id="filters-content"');

    expect(root).toContain("data-disable-pointer-dismissal");
    expect(trigger).toContain('aria-haspopup="dialog"');
    expect(trigger).toContain('aria-expanded="false"');
    expect(content).toContain('role="dialog"');
    expect(content).toContain('popover="manual"');
    expect(content).toContain('data-side="right"');
    expect(content).toContain('data-align="end"');
    expect(content).toContain("--ormo-popover-side-offset: 8px");
    expect(content).toContain('data-final-focus="#after-filters"');
  });

  it("renders title, description and close semantics", async () => {
    const html = await container.renderToString(Default);

    expect(html).toContain("data-ormo-popover-title");
    expect(html).toContain("data-ormo-popover-description");
    expect(html).toContain("data-ormo-popover-close");
    expect(html).toContain('value="done"');
  });
});
