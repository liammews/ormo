import { experimental_AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";

import InvalidField from "../fixtures/field/Invalid.astro";
import ValidField from "../fixtures/field/Valid.astro";

function findOpeningTag(
  html: string,
  tagName: string,
  attribute: string,
): string {
  const match = html.match(
    new RegExp(`<${tagName}[^>]*${attribute}(?:=[^ >]+)?[^>]*>`),
  );
  if (!match) {
    throw new Error(`Expected <${tagName}> with ${attribute}`);
  }
  return match[0];
}

describe("Field markup", () => {
  let container: Awaited<ReturnType<typeof experimental_AstroContainer.create>>;

  beforeAll(async () => {
    container = await experimental_AstroContainer.create();
  });

  it("renders native control semantics and an explicit invalid state", async () => {
    const html = await container.renderToString(InvalidField);
    const root = findOpeningTag(html, "ormo-field", 'id="account-email-field"');
    const label = findOpeningTag(html, "label", "data-ormo-field-label");
    const control = findOpeningTag(html, "input", "data-ormo-field-control");
    const error = findOpeningTag(html, "div", "data-ormo-field-error");

    expect(root).toContain("data-invalid");
    expect(root).not.toContain('name="email"');
    expect(root).not.toMatch(/\srequired(?:\s|>)/);

    expect(label).toContain('for="account-email-field-control"');
    expect(control).toContain('id="account-email-field-control"');
    expect(control).toContain('name="email"');
    expect(control).toContain("required");
    expect(control).toContain('aria-invalid="true"');
    expect(control).toContain(
      'aria-describedby="account-email-help account-email-error"',
    );

    expect(error).toContain('id="account-email-error"');
    expect(error).toContain('role="alert"');
    expect(error).not.toMatch(/\shidden(?:\s|>)/);
  });

  it("keeps validity-specific errors hidden and native disabled state intact", async () => {
    const html = await container.renderToString(ValidField);
    const control = findOpeningTag(html, "input", "data-ormo-field-control");
    const error = findOpeningTag(html, "div", "data-ormo-field-error");

    expect(control).toContain('name="email"');
    expect(control).toContain("disabled");
    expect(control).not.toContain("aria-invalid");
    expect(error).toContain('data-match="valueMissing"');
    expect(error).toMatch(/\shidden(?:\s|>)/);
  });
});
