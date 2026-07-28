import { experimental_AstroContainer } from "astro/container";
import { beforeAll, describe, expect, expectTypeOf, it } from "vitest";

import type { RadioProps } from "../../src/components/radio/types";
import GroupMarkup from "../fixtures/radio/GroupMarkup.astro";
import RadioMarkup from "../fixtures/radio/RadioMarkup.astro";

describe("Radio markup", () => {
  let container: Awaited<ReturnType<typeof experimental_AstroContainer.create>>;

  beforeAll(async () => {
    container = await experimental_AstroContainer.create();
  });

  it("renders a native radio and aria-hidden indicator", async () => {
    const html = await container.renderToString(RadioMarkup);

    expect(html).toContain('type="radio"');
    expect(html).toContain('name="size"');
    expect(html).toContain('value="2"');
    expect(html).toContain("checked");
    expect(html).toContain("required");
    expect(html).toContain("data-ormo-radio-indicator");
    expect(html).toContain('aria-hidden="true"');
  });

  it("resolves group labels and member state during SSR", async () => {
    const html = await container.renderToString(GroupMarkup);
    const inputs = html.match(/<input[^>]*data-ormo-radio[^>]*>/g) ?? [];

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain(
      'aria-labelledby="delivery-label delivery-options-label-2"',
    );
    expect(html).toContain('aria-required="true"');
    expect(inputs).toHaveLength(3);
    expect(inputs[0]).toContain('name="delivery"');
    expect(inputs[0]).not.toContain("data-item-name-authored");
    expect(inputs[1]).toContain('name="custom-delivery"');
    expect(inputs[1]).toContain("data-item-name-authored");
    expect(inputs[2]).toContain('name="delivery"');
    expect(inputs[2]).toContain("checked");
    expect(inputs.every((input) => input.includes("required"))).toBe(true);
  });

  it("accepts only scalar radio values", () => {
    expectTypeOf<RadioProps["value"]>().toEqualTypeOf<
      string | number | undefined
    >();
  });
});
