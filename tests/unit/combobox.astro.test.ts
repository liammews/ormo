import { experimental_AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import Default from "../fixtures/combobox/Default.astro";

describe("Combobox markup", () => {
  let container: Awaited<ReturnType<typeof experimental_AstroContainer.create>>;

  beforeAll(async () => {
    container = await experimental_AstroContainer.create();
  });

  it("renders a native fallback and editable combobox interface", async () => {
    const html = await container.renderToString(Default);
    expect(html).toContain("<ormo-combobox");
    expect(html).toContain('id="country-control"');
    expect(html).toContain('name="country"');
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-autocomplete="list"');
    expect(html).toContain('role="listbox"');
    expect(html).toContain('<optgroup label="Europe">');
    expect(html).toMatch(/<option value="fr" selected[^>]*>France<\/option>/);
    expect(html).toContain('data-keywords="French Republic"');
    expect(html).toContain("data-ormo-combobox-item-indicator");
    expect(html).toContain("data-ormo-combobox-empty");
  });
});
