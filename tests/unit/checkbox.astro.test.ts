import { experimental_AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";

import GroupMarkup from "../fixtures/checkbox/GroupMarkup.astro";

describe("Checkbox markup", () => {
  let container: Awaited<ReturnType<typeof experimental_AstroContainer.create>>;

  beforeAll(async () => {
    container = await experimental_AstroContainer.create();
  });

  it("renders truthful group state and resolves authored label ids", async () => {
    const html = await container.renderToString(GroupMarkup);

    expect(html).toContain('data-state="partial"');
    expect(html).toContain(
      'aria-labelledby="transport-label transport-options-label-2"',
    );
    expect(html).toContain('id="transport-label"');
    expect(html).toContain('id="transport-options-label-2"');
    expect(html).toContain(
      'data-managed-labelledby="transport-label transport-options-label-2"',
    );
  });

  it("distinguishes inherited and authored member names", async () => {
    const html = await container.renderToString(GroupMarkup);
    const inputs = html.match(/<input[^>]*data-ormo-checkbox[^>]*>/g) ?? [];

    expect(inputs).toHaveLength(3);
    expect(inputs[0]).toContain('name="transport"');
    expect(inputs[0]).not.toContain("data-item-name-authored");
    expect(inputs[1]).toContain('name="custom-transport"');
    expect(inputs[1]).toContain("data-item-name-authored");
    expect(inputs[2]).toContain('name="transport"');
    expect(inputs[2]).toContain("checked");
  });
});
