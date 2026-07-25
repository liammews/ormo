import { experimental_AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";

import CurrentLinkTrail from "../fixtures/breadcrumbs/CurrentLinkTrail.astro";
import DefaultTrail from "../fixtures/breadcrumbs/DefaultTrail.astro";
import LabelledByTrail from "../fixtures/breadcrumbs/LabelledByTrail.astro";
import MicrodataTrail from "../fixtures/breadcrumbs/MicrodataTrail.astro";
import TwoLists from "../fixtures/breadcrumbs/TwoLists.astro";

describe("Breadcrumbs markup", () => {
  let container: Awaited<ReturnType<typeof experimental_AstroContainer.create>>;

  beforeAll(async () => {
    container = await experimental_AstroContainer.create();
  });

  it("renders a labelled nav landmark with an ordered list", async () => {
    const html = await container.renderToString(DefaultTrail);

    expect(html).toContain('data-ormo-breadcrumbs-root');
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toMatch(/<ol[^>]*data-ormo-breadcrumbs-list/);
    expect(html).toContain('href="/books"');
    expect(html).toContain('href="/books/sciencefiction"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Award Winners");
    expect(html).not.toContain("itemscope");
    expect(html).not.toContain("itemtype");
  });

  it("hides separators from the accessibility tree", async () => {
    const html = await container.renderToString(DefaultTrail);
    const separatorMatches =
      html.match(
        /<li[^>]*data-ormo-breadcrumbs-separator[^>]*>/g,
      ) ?? [];

    expect(separatorMatches.length).toBe(2);
    for (const separator of separatorMatches) {
      expect(separator).toContain('role="presentation"');
      expect(separator).toContain('aria-hidden="true"');
    }
  });

  it("supports a current link and custom landmark label", async () => {
    const html = await container.renderToString(CurrentLinkTrail);

    expect(html).toContain('aria-label="You are here"');
    expect(html).toMatch(
      /<a[^>]*href="\/docs"[^>]*aria-current="page"[^>]*>|aria-current="page"[^>]*href="\/docs"/,
    );
    expect(html).not.toContain("data-ormo-breadcrumbs-page");
  });

  it("omits the default aria-label when aria-labelledby is set", async () => {
    const html = await container.renderToString(LabelledByTrail);

    expect(html).toContain('aria-labelledby="crumb-heading"');
    expect(html).not.toContain('aria-label="Breadcrumb"');
    expect(html).toContain('id="crumb-heading"');
  });

  it("annotates Schema.org microdata when enabled", async () => {
    const html = await container.renderToString(MicrodataTrail);

    expect(html).toContain('data-microdata');
    expect(html).toContain('itemtype="https://schema.org/BreadcrumbList"');
    expect(html).toContain('itemtype="https://schema.org/ListItem"');
    expect(html).toContain('itemprop="itemListElement"');
    expect(html).toContain('itemprop="item"');
    expect(html).toContain('<span itemprop="name">Books</span>');
    expect(html).toContain('<meta itemprop="name" content="Science Fiction">');
    expect(html).toContain("Sci-Fi");
    expect(html).toMatch(
      /<span[^>]*itemprop="name"[^>]*aria-current="page"|aria-current="page"[^>]*itemprop="name"/,
    );
    expect(html).toContain('<meta itemprop="position" content="1">');
    expect(html).toContain('<meta itemprop="position" content="2">');
    expect(html).toContain('<meta itemprop="position" content="3">');
    expect(html).not.toContain('content="4"');
  });

  it("resets microdata positions per list", async () => {
    const html = await container.renderToString(TwoLists);
    const positions =
      html.match(/<meta itemprop="position" content="(\d+)">/g) ?? [];

    expect(positions).toEqual([
      '<meta itemprop="position" content="1">',
      '<meta itemprop="position" content="2">',
      '<meta itemprop="position" content="1">',
      '<meta itemprop="position" content="2">',
    ]);
  });
});
