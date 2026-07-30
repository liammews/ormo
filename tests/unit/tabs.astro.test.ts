import { experimental_AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";

import Default from "../fixtures/tabs/Default.astro";
import { findOpeningTag } from "./helpers/astro";

describe("Tabs markup", () => {
  let container: Awaited<ReturnType<typeof experimental_AstroContainer.create>>;

  beforeAll(async () => {
    container = await experimental_AstroContainer.create();
  });

  it("renders orientation and initial selection on the server", async () => {
    const html = await container.renderToString(Default);
    const root = findOpeningTag(html, "ormo-tabs", 'id="project-tabs"');
    const selected = findOpeningTag(html, "button", 'aria-selected="true"');
    const panel = findOpeningTag(html, "div", 'data-state="active"');

    expect(root).toContain('data-orientation="vertical"');
    expect(root).toContain("data-activate-on-focus");
    expect(root).toContain('data-loop-focus="false"');
    expect(selected).toContain('tabindex="0"');
    expect(selected).toContain("aria-controls=");
    expect(panel).toContain("aria-labelledby=");
    expect(panel).not.toContain(" hidden");
  });

  it("renders disabled and inactive tabs", async () => {
    const html = await container.renderToString(Default);
    const disabled = findOpeningTag(html, "button", "disabled");
    const inactive = findOpeningTag(html, "div", 'data-state="inactive"');

    expect(disabled).toContain('aria-selected="false"');
    expect(disabled).toContain('tabindex="-1"');
    expect(inactive).toContain("hidden");
  });
});
