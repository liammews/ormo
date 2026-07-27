import { experimental_AstroContainer } from "astro/container";
import { beforeAll, describe, expect, expectTypeOf, it } from "vitest";

import Button from "../../src/components/button/Button.astro";
import type {
  ButtonAsButtonProps,
  ButtonAsNonNativeProps,
} from "../../src/components/button/types";

describe("Button markup", () => {
  let container: Awaited<ReturnType<typeof experimental_AstroContainer.create>>;

  beforeAll(async () => {
    container = await experimental_AstroContainer.create();
  });

  async function renderTag(
    props: Record<string, unknown> = {},
  ): Promise<string> {
    const html = await container.renderToString(Button, {
      props,
      slots: { default: "Action" },
    });
    const tag = html.match(/<(?:button|div|span)\b[^>]*>/)?.[0];
    expect(tag).toBeDefined();
    return tag!;
  }

  it("renders a safe native default", async () => {
    const tag = await renderTag();

    expect(tag).toContain('type="button"');
    expect(tag).toContain("data-ormo-button");
    expect(tag).toContain('data-native-button="true"');
    expect(tag).not.toContain(" disabled");
  });

  it("fails closed before upgrading a focusable disabled native button", async () => {
    const tag = await renderTag({
      disabled: true,
      focusableWhenDisabled: true,
      type: "submit",
    });

    expect(tag).toContain('type="submit"');
    expect(tag).toMatch(/\sdisabled(?:\s|>)/);
    expect(tag).toContain('aria-disabled="true"');
    expect(tag).toContain("data-ormo-button-disabled");
    expect(tag).toContain("data-focusable-when-disabled");
  });

  it("strips consumer attempts to override managed native attributes", async () => {
    const tag = await renderTag({
      "aria-disabled": "true",
      "data-ormo-button": "spoofed",
      "data-native-button": "false",
      "data-ormo-button-disabled": "",
      "data-ormo-button-tabindex": "9",
      "data-disabled": "spoofed",
      "data-pending": "",
      "data-focusable-when-disabled": "",
    });

    expect(tag.match(/data-ormo-button(?:=|\s|>)/g)).toHaveLength(1);
    expect(tag.match(/data-native-button=/g)).toHaveLength(1);
    expect(tag).toContain('data-native-button="true"');
    expect(tag).not.toContain("aria-disabled");
    expect(tag).not.toContain("data-ormo-button-disabled");
    expect(tag).not.toContain("data-ormo-button-tabindex");
    expect(tag).not.toContain("data-disabled");
    expect(tag).not.toContain("data-pending");
    expect(tag).not.toContain("data-focusable-when-disabled");
  });

  it("canonicalizes non-native semantics and internal attributes", async () => {
    const tag = await renderTag({
      as: "div",
      role: "link",
      type: "submit",
      "aria-disabled": "true",
      "data-native-button": "true",
      "data-disabled": "spoofed",
    });

    expect(tag).toContain('role="button"');
    expect(tag).not.toContain('role="link"');
    expect(tag).not.toContain('type="submit"');
    expect(tag).not.toContain("aria-disabled");
    expect(tag).toContain('data-native-button="false"');
    expect(tag).not.toContain("data-disabled");
  });

  it("normalizes untyped boolean and type values defensively", async () => {
    expect(await renderTag({ disabled: "" })).toMatch(/\sdisabled(?:\s|>)/);
    expect(await renderTag({ disabled: "true" })).toMatch(/\sdisabled(?:\s|>)/);
    expect(await renderTag({ disabled: "false" })).not.toContain(" disabled");
    expect(await renderTag({ type: null })).toContain('type="button"');
    expect(await renderTag({ type: "invalid" })).toContain('type="button"');
  });

  it.each([
    [undefined, "0", "-1"],
    [-1, "-1", "-1"],
    [0, "0", "-1"],
    [3, "3", "-1"],
  ])(
    "serializes an enabled tabindex baseline for disabled non-native state (%s)",
    async (tabindex, baseline, effective) => {
      const tag = await renderTag({ as: "div", disabled: true, tabindex });

      expect(tag).toContain(`data-ormo-button-tabindex="${baseline}"`);
      expect(tag).toContain(`tabindex="${effective}"`);
    },
  );

  it("temporarily makes a negative tabindex sequentially focusable", async () => {
    const tag = await renderTag({
      as: "span",
      disabled: true,
      focusableWhenDisabled: true,
      tabindex: -1,
    });

    expect(tag).toContain('tabindex="0"');
    expect(tag).toContain('data-ormo-button-tabindex="-1"');
  });
});

describe("Button public types", () => {
  it("exposes boolean disabled and safe native button types", () => {
    expectTypeOf<ButtonAsButtonProps["disabled"]>().toEqualTypeOf<
      boolean | undefined
    >();
    expectTypeOf<ButtonAsButtonProps["type"]>().toEqualTypeOf<
      "button" | "submit" | "reset" | undefined
    >();
    expectTypeOf<ButtonAsNonNativeProps["type"]>().toEqualTypeOf<undefined>();
  });
});
