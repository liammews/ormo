import { experimental_AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import Default from "../fixtures/autocomplete/Default.astro";

describe("Autocomplete markup", () => {
  let container: Awaited<ReturnType<typeof experimental_AstroContainer.create>>;
  beforeAll(async () => {
    container = await experimental_AstroContainer.create();
  });

  it("renders a native text field and suggestion semantics", async () => {
    const html = await container.renderToString(Default);
    expect(html).toContain("<ormo-autocomplete");
    expect(html).toContain('id="location-input"');
    expect(html).toContain('name="location"');
    expect(html).toContain('value="Lon"');
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-autocomplete="list"');
    expect(html).toContain('role="listbox"');
    expect(html).toContain('data-identifier="london"');
    expect(html).toContain('data-keywords="LDN"');
    expect(html).toContain("data-ormo-autocomplete-loading");
    expect(html).toContain("data-ormo-autocomplete-empty");
  });
});
