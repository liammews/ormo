import { experimental_AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";

import Default from "../fixtures/select/Default.astro";
import Native from "../fixtures/select/Native.astro";

describe("Select markup", () => {
  let container: Awaited<ReturnType<typeof experimental_AstroContainer.create>>;

  beforeAll(async () => {
    container = await experimental_AstroContainer.create();
  });

  it("renders a native form fallback beside the custom interface", async () => {
    const html = await container.renderToString(Default);

    expect(html).toContain("<ormo-select");
    expect(html).toContain('data-default-value="fr"');
    expect(html).toContain('name="country"');
    expect(html).toContain('id="country-control"');
    expect(html).toContain("required");
    expect(html).toContain('<option value=""');
    expect(html).toContain('<optgroup label="Europe">');
    expect(html).toMatch(/<option value="fr" selected[^>]*>France<\/option>/);
    expect(html).toContain('role="combobox"');
    expect(html).toContain('role="listbox"');
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-labelledby="europe-label"');
    expect(html.match(/data-ormo-select-separator/g)).toHaveLength(1);
    expect(html).toContain(
      'aria-hidden="true" data-ormo-select-separator data-automatic',
    );
    expect(html).not.toContain('role="separator"');
    expect(html).toContain('data-value="us"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('data-text-value="Café © 🚀 ≂̸"');
  });

  it("renders only native select semantics in native mode", async () => {
    const html = await container.renderToString(Native);

    expect(html).toContain('<select class="country"');
    expect(html).toContain("data-ormo-select-native");
    expect(html).toContain('<optgroup label="Europe">');
    expect(html).toMatch(/<option value="fr" selected[^>]*>France<\/option>/);
    expect(html).toContain("<hr");
    expect(html).not.toContain("<ormo-select");
    expect(html).not.toContain('role="combobox"');
    expect(html).not.toContain("src/runtime/select");
  });
});
