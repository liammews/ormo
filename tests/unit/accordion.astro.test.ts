import { experimental_AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";

import Default from "../fixtures/accordion/Default.astro";
import { findOpeningTag } from "./helpers/astro";

describe("Accordion markup", () => {
  let container: Awaited<ReturnType<typeof experimental_AstroContainer.create>>;

  beforeAll(async () => {
    container = await experimental_AstroContainer.create();
  });

  it("renders initial state and relationships from the server", async () => {
    const html = await container.renderToString(Default);
    const root = findOpeningTag(html, "ormo-accordion", 'id="faq"');
    const openTrigger = findOpeningTag(html, "button", 'aria-expanded="true"');
    const openContent = findOpeningTag(html, "div", 'data-state="open"');

    expect(root).toContain('data-type="single"');
    expect(root).toContain('data-default-value="&quot;shipping&quot;"');
    expect(root).toContain('data-collapsible="false"');
    expect(openTrigger).not.toContain("aria-controls=");
    expect(openContent).not.toContain("aria-labelledby=");
    expect(openContent).not.toContain(" hidden");
  });

  it("renders disabled and closed item semantics", async () => {
    const html = await container.renderToString(Default);
    const item = findOpeningTag(html, "div", 'data-value="returns"');
    const trigger = findOpeningTag(html, "button", 'aria-expanded="false"');
    const content = findOpeningTag(html, "div", 'hidden="until-found"');

    expect(item).toContain("data-item-disabled");
    expect(trigger).not.toContain("disabled");
    expect(content).toContain('data-state="closed"');
    expect(content).toContain('hidden="until-found"');
  });
});
