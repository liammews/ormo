import { experimental_AstroContainer } from "astro/container";
import { expect, it } from "vitest";
import Default from "../fixtures/number-field/Default.astro";

it("renders native number input and step controls", async () => {
  const container = await experimental_AstroContainer.create();
  const html = await container.renderToString(Default);
  expect(html).toContain("<ormo-number-field");
  expect(html).toContain('data-default-value="2"');
  expect(html).toContain('type="number"');
  expect(html).toContain('value="2"');
  expect(html).toContain('min="0"');
  expect(html).toContain('max="10"');
  expect(html).toContain('step="0.5"');
  expect(html).toContain('name="quantity"');
  expect(html).toContain("required");
  expect(html).toContain('type="button"');
});
