import { experimental_AstroContainer } from "astro/container";
import { beforeAll, describe, expect, expectTypeOf, it } from "vitest";

import type { AvatarImageProps } from "../../src/components/avatar/types";
import Delayed from "../fixtures/avatar/Delayed.astro";
import FallbackOnly from "../fixtures/avatar/FallbackOnly.astro";
import Nested from "../fixtures/avatar/Nested.astro";
import WithImage from "../fixtures/avatar/WithImage.astro";

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

describe("Avatar markup", () => {
  let container: Awaited<ReturnType<typeof experimental_AstroContainer.create>>;

  beforeAll(async () => {
    container = await experimental_AstroContainer.create();
  });

  it("requires alt text while allowing an empty string", () => {
    expectTypeOf<Pick<AvatarImageProps, "alt">>().toEqualTypeOf<{
      alt: string;
    }>();
  });

  it("renders loading markup without a client-side visibility swap", async () => {
    const html = await container.renderToString(WithImage);
    const root = findOpeningTag(html, "ormo-avatar", 'id="profile-avatar"');
    const image = findOpeningTag(html, "img", "data-ormo-avatar-image");
    const fallback = findOpeningTag(html, "span", "data-ormo-avatar-fallback");

    expect(root).toContain('data-status="loading"');
    expect(root).not.toContain('data-status="authored"');
    expect(root).toContain('role="img"');
    expect(root).toContain('aria-label="Ada Lovelace"');
    expect(image).toContain('src="/ada.png"');
    expect(image).toContain('srcset="/ada.png 1x, /ada-2x.png 2x"');
    expect(image).toMatch(/\salt(?:="")?(?:\s|>)/);
    expect(image).toMatch(/\shidden(?:\s|>)/);
    expect(fallback).not.toMatch(/\shidden(?:\s|>)/);
  });

  it("hides both parts while a delayed image is loading", async () => {
    const html = await container.renderToString(Delayed);
    const root = findOpeningTag(html, "ormo-avatar", 'id="delayed-avatar"');
    const image = findOpeningTag(html, "img", "data-ormo-avatar-image");
    const fallback = findOpeningTag(html, "span", "data-ormo-avatar-fallback");

    expect(root).toContain('data-status="loading"');
    expect(image).toMatch(/\shidden(?:\s|>)/);
    expect(fallback).toContain('data-delay="600"');
    expect(fallback).toMatch(/\shidden(?:\s|>)/);
  });

  it("shows a fallback immediately when there is no image source", async () => {
    const html = await container.renderToString(FallbackOnly);
    const root = findOpeningTag(html, "ormo-avatar", 'id="fallback-avatar"');
    const fallback = findOpeningTag(html, "span", "data-ormo-avatar-fallback");

    expect(root).toContain('data-status="error"');
    expect(fallback).toContain('data-delay="600"');
    expect(fallback).not.toMatch(/\shidden(?:\s|>)/);
  });

  it("isolates nested avatar rendering contexts", async () => {
    const html = await container.renderToString(Nested);
    const outer = findOpeningTag(html, "ormo-avatar", 'id="outer-avatar"');
    const inner = findOpeningTag(html, "ormo-avatar", 'id="inner-avatar"');
    const fallbacks = html.match(/<span[^>]*data-ormo-avatar-fallback[^>]*>/g);

    expect(outer).toContain('data-status="loading"');
    expect(inner).toContain('data-status="error"');
    expect(fallbacks).toHaveLength(2);
    for (const fallback of fallbacks ?? []) {
      expect(fallback).not.toMatch(/\shidden(?:\s|>)/);
    }
  });
});
