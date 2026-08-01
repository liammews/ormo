import { experimental_AstroContainer } from "astro/container";
import { beforeAll, describe, expect, expectTypeOf, it } from "vitest";

import Separator from "../../src/components/separator/Separator.astro";
import type {
  SeparatorOrientation,
  SeparatorProps,
} from "../../src/components/separator/types";
import Default from "../fixtures/separator/Default.astro";
import { findOpeningTag } from "./helpers/astro";

describe("Separator markup", () => {
  let container: Awaited<ReturnType<typeof experimental_AstroContainer.create>>;

  beforeAll(async () => {
    container = await experimental_AstroContainer.create();
  });

  it("renders a semantic horizontal separator by default", async () => {
    const html = await container.renderToString(Separator);
    const separator = findOpeningTag(html, "div", "data-ormo-separator");

    expect(separator).toContain('role="separator"');
    expect(separator).toContain('aria-orientation="horizontal"');
    expect(separator).toContain('data-orientation="horizontal"');
    expect(html).toContain("</div>");
    expect(html).not.toContain("<script");
  });

  it("renders vertical orientation semantics and styling state", async () => {
    const html = await container.renderToString(Separator, {
      props: { orientation: "vertical" },
    });
    const separator = findOpeningTag(html, "div", "data-ormo-separator");

    expect(separator).toContain('role="separator"');
    expect(separator).toContain('aria-orientation="vertical"');
    expect(separator).toContain('data-orientation="vertical"');
  });

  it("removes decorative separators from the accessibility tree", async () => {
    const html = await container.renderToString(Separator, {
      props: { decorative: true, orientation: "vertical" },
    });
    const separator = findOpeningTag(html, "div", "data-ormo-separator");

    expect(separator).toContain('role="none"');
    expect(separator).toContain('data-orientation="vertical"');
    expect(separator).not.toContain("aria-orientation");
    expect(separator).not.toContain('role="separator"');
  });

  it("forwards native attributes and owns semantic attributes", async () => {
    const html = await container.renderToString(Separator, {
      props: {
        id: "content-divider",
        class: "rule",
        title: "More content follows",
        "data-testid": "separator",
        role: "button",
        "aria-orientation": "vertical",
        "data-orientation": "vertical",
        "data-ormo-separator": "spoofed",
      },
    });
    const separator = findOpeningTag(html, "div", "data-ormo-separator");

    expect(separator).toContain('id="content-divider"');
    expect(separator).toContain('class="rule"');
    expect(separator).toContain('title="More content follows"');
    expect(separator).toContain('data-testid="separator"');
    expect(separator.match(/\srole=/g)).toHaveLength(1);
    expect(separator).toContain('role="separator"');
    expect(separator.match(/aria-orientation=/g)).toHaveLength(1);
    expect(separator).toContain('aria-orientation="horizontal"');
    expect(separator.match(/data-orientation=/g)).toHaveLength(1);
    expect(separator).toContain('data-orientation="horizontal"');
    expect(separator.match(/data-ormo-separator(?:=|\s|>)/g)).toHaveLength(1);
    expect(separator).not.toContain('data-ormo-separator="spoofed"');
  });

  it("composes the public fixture without a runtime", async () => {
    const html = await container.renderToString(Default);

    expect(html.match(/data-ormo-separator/g)).toHaveLength(3);
    expect(html).not.toContain("<script");
  });
});

describe("Separator public types", () => {
  it("limits orientation to horizontal or vertical", () => {
    expectTypeOf<SeparatorProps["orientation"]>().toEqualTypeOf<
      SeparatorOrientation | undefined
    >();
    expectTypeOf<
      Extract<SeparatorOrientation, "horizontal">
    >().toEqualTypeOf<"horizontal">();
    expectTypeOf<
      Extract<SeparatorOrientation, "diagonal">
    >().toEqualTypeOf<never>();
  });
});
