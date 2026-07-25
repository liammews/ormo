import { experimental_AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";

import Legend from "../../src/components/fieldset/Legend.astro";
import Root from "../../src/components/fieldset/Root.astro";

describe("Fieldset markup", () => {
  let container: Awaited<ReturnType<typeof experimental_AstroContainer.create>>;

  beforeAll(async () => {
    container = await experimental_AstroContainer.create();
  });

  it("composes a native fieldset and legend", async () => {
    const legend = await container.renderToString(Legend, {
      slots: { default: "Contact details" },
    });
    const html = await container.renderToString(Root, {
      slots: { default: `${legend}<input name="email">` },
    });

    expect(html).toMatch(/<fieldset[^>]*data-ormo-fieldset-root[^>]*>/);
    expect(html).toMatch(/<legend[^>]*data-ormo-fieldset-legend[^>]*>/);
    expect(html).toContain("Contact details");
    expect(html).toContain('<input name="email">');
    expect(html).toMatch(/<\/legend>[\s\S]*<input name="email">/);
    expect(html).toMatch(/<\/fieldset>/);
    expect(html).not.toContain("<script");
  });

  it("forwards native fieldset attributes without synthetic defaults", async () => {
    const html = await container.renderToString(Root, {
      props: {
        id: "contact-fields",
        name: "contact",
        form: "profile-form",
        disabled: true,
        class: "group",
        "aria-describedby": "contact-help",
        "data-testid": "contact-fieldset",
      },
      slots: { default: "Fields" },
    });

    expect(html).toContain('id="contact-fields"');
    expect(html).toContain('name="contact"');
    expect(html).toContain('form="profile-form"');
    expect(html).toMatch(/<fieldset[^>]*\sdisabled(?:="")?[^>]*>/);
    expect(html).toContain('class="group"');
    expect(html).toContain('aria-describedby="contact-help"');
    expect(html).toContain('data-testid="contact-fieldset"');
    expect(html).not.toContain('role="group"');
  });

  it("forwards native legend attributes", async () => {
    const html = await container.renderToString(Legend, {
      props: {
        id: "contact-legend",
        class: "caption",
        title: "Required contact information",
        "aria-hidden": "true",
        "data-testid": "contact-legend",
      },
      slots: { default: "Contact" },
    });

    expect(html).toMatch(/<legend[^>]*data-ormo-fieldset-legend[^>]*>/);
    expect(html).toContain('id="contact-legend"');
    expect(html).toContain('class="caption"');
    expect(html).toContain('title="Required contact information"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-testid="contact-legend"');
    expect(html).toContain("Contact");
  });
});
