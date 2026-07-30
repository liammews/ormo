import { experimental_AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";

import DefaultDialog from "../fixtures/dialog/Default.astro";

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

describe("Dialog markup", () => {
  let container: Awaited<ReturnType<typeof experimental_AstroContainer.create>>;

  beforeAll(async () => {
    container = await experimental_AstroContainer.create();
  });

  it("renders native modal semantics and closed initial state", async () => {
    const html = await container.renderToString(DefaultDialog);
    const root = findOpeningTag(html, "ormo-dialog", 'id="profile-dialog"');
    const trigger = findOpeningTag(html, "button", 'id="profile-trigger"');
    const content = findOpeningTag(html, "dialog", 'id="profile-content"');

    expect(root).toContain('class="dialog-root"');
    expect(root).toContain("data-disable-pointer-dismissal");
    expect(root).toContain('data-state="closed"');
    expect(root).not.toMatch(/\sdata-open(?:\s|>)/);

    expect(trigger).toContain('type="button"');
    expect(trigger).toContain('aria-haspopup="dialog"');
    expect(trigger).toContain('data-state="closed"');

    expect(content).toContain('class="dialog-content"');
    expect(content).toContain('tabindex="-1"');
    expect(content).toContain('role="dialog"');
    expect(content).toContain('aria-modal="true"');
    expect(content).toContain('data-final-focus="#after-profile"');
    expect(content).toContain('data-state="closed"');
    expect(content).not.toMatch(/\sopen(?:\s|>)/);
  });

  it("renders semantic parts and forwards authored attributes", async () => {
    const html = await container.renderToString(DefaultDialog);
    const title = findOpeningTag(html, "h3", 'id="profile-title"');
    const description = findOpeningTag(html, "div", 'id="profile-description"');
    const close = findOpeningTag(html, "button", "data-ormo-dialog-close");

    expect(title).toContain('class="dialog-title"');
    expect(title).toContain("data-ormo-dialog-title");
    expect(description).toContain('class="dialog-description"');
    expect(description).toContain("data-ormo-dialog-description");
    expect(close).toContain('class="dialog-close"');
    expect(close).toContain('value="saved"');
    expect(close).toContain('type="button"');
  });
});
