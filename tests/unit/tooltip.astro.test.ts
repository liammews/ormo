import { experimental_AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";

import Default from "../fixtures/tooltip/Default.astro";
import { findOpeningTag } from "./helpers/astro";

describe("Tooltip markup", () => {
  let container: Awaited<ReturnType<typeof experimental_AstroContainer.create>>;

  beforeAll(async () => {
    container = await experimental_AstroContainer.create();
  });

  it("renders the closed trigger and tooltip relationship", async () => {
    const html = await container.renderToString(Default);
    const root = findOpeningTag(html, "ormo-tooltip", 'id="save-tip"');
    const trigger = findOpeningTag(html, "button", 'class="trigger"');
    const content = findOpeningTag(html, "div", 'role="tooltip"');

    expect(root).toContain('data-delay="400"');
    expect(root).toContain('data-close-delay="100"');
    expect(trigger).not.toContain("aria-describedby=");
    expect(content).toContain('popover="manual"');
    expect(content).toContain('data-side="bottom"');
    expect(content).toContain('data-align="start"');
    expect(content).toContain("--ormo-tooltip-side-offset: 6px");
    expect(content).toContain('data-state="closed"');
  });
});
