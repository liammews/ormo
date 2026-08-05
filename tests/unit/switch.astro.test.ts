import { experimental_AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import Default from "../fixtures/switch/Default.astro";
import ReadOnly from "../fixtures/switch/ReadOnly.astro";

describe("Switch markup", () => {
  let container: Awaited<ReturnType<typeof experimental_AstroContainer.create>>;

  beforeAll(async () => {
    container = await experimental_AstroContainer.create();
  });

  it("renders native switch, form, and thumb semantics", async () => {
    const html = await container.renderToString(Default);
    expect(html).toContain("<ormo-switch");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('role="switch"');
    expect(html).toContain('name="notifications"');
    expect(html).toContain('value="enabled"');
    expect(html).toContain("checked");
    expect(html).toContain("required");
    expect(html).toContain('data-state="checked"');
    expect(html).toContain('aria-hidden="true"');
  });

  it("keeps readonly immutable until the runtime enhances it", async () => {
    const html = await container.renderToString(ReadOnly);
    expect(html).toContain("disabled");
    expect(html).toContain('aria-readonly="true"');
    expect(html).toContain("data-ormo-switch-readonly-fallback");
  });
});
