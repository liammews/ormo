import { experimental_AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";

import DefaultAlertDialog from "../fixtures/alert-dialog/Default.astro";

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

describe("Alert Dialog markup", () => {
  let container: Awaited<ReturnType<typeof experimental_AstroContainer.create>>;

  beforeAll(async () => {
    container = await experimental_AstroContainer.create();
  });

  it("renders native modal semantics and closed initial state", async () => {
    const html = await container.renderToString(DefaultAlertDialog);
    const root = findOpeningTag(html, "ormo-alert-dialog", 'id="delete-alert"');
    const trigger = findOpeningTag(html, "button", 'id="delete-trigger"');
    const content = findOpeningTag(html, "dialog", 'id="delete-content"');

    expect(root).toContain('class="alert-root"');
    expect(root).toContain('data-state="closed"');
    expect(root).not.toMatch(/\sdata-open(?:\s|>)/);

    expect(trigger).toContain('type="button"');
    expect(trigger).toContain('aria-haspopup="dialog"');
    expect(trigger).toContain('data-state="closed"');

    expect(content).toContain('class="alert-content"');
    expect(content).toContain('tabindex="-1"');
    expect(content).toContain('role="alertdialog"');
    expect(content).toContain('aria-modal="true"');
    expect(content).toContain('data-final-focus="#after-delete"');
    expect(content).toContain('data-state="closed"');
    expect(content).not.toMatch(/\sopen(?:\s|>)/);
  });

  it("renders the authored semantic parts and forwards attributes", async () => {
    const html = await container.renderToString(DefaultAlertDialog);
    const title = findOpeningTag(html, "h3", 'id="delete-title"');
    const description = findOpeningTag(html, "div", 'id="delete-description"');
    const cancel = findOpeningTag(
      html,
      "button",
      "data-ormo-alert-dialog-cancel",
    );
    const action = findOpeningTag(
      html,
      "button",
      "data-ormo-alert-dialog-action",
    );

    expect(title).toContain('class="alert-title"');
    expect(title).toContain("data-ormo-alert-dialog-title");
    expect(description).toContain('class="alert-description"');
    expect(description).toContain("data-ormo-alert-dialog-description");
    expect(cancel).toContain('class="alert-cancel"');
    expect(cancel).toContain('value="cancel"');
    expect(action).toContain('class="alert-action"');
    expect(action).toContain('value="delete"');
  });
});
