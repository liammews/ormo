import { experimental_AstroContainer } from "astro/container";
import { beforeAll, describe, expect, expectTypeOf, it } from "vitest";

import Input from "../../src/components/password-field/Input.astro";
import Toggle from "../../src/components/password-field/Toggle.astro";
import type {
  OrmoPasswordFieldElement,
  PasswordFieldInputProps,
  PasswordFieldRootProps,
  PasswordFieldToggleProps,
  PasswordVisibilityChangeDetail,
} from "../../src/components/password-field/types";
import DisabledToggle from "../fixtures/password-field/DisabledToggle.astro";
import Default from "../fixtures/password-field/Default.astro";
import Visible from "../fixtures/password-field/Visible.astro";
import { findOpeningTag } from "./helpers/astro";

describe("Password Field markup", () => {
  let container: Awaited<ReturnType<typeof experimental_AstroContainer.create>>;

  beforeAll(async () => {
    container = await experimental_AstroContainer.create();
  });

  it("renders a masked native password field with a labelled toggle", async () => {
    const html = await container.renderToString(Default);
    const root = findOpeningTag(
      html,
      "ormo-password-field",
      "data-ormo-password-field-root",
    );
    const input = findOpeningTag(
      html,
      "input",
      "data-ormo-password-field-input",
    );
    const toggle = findOpeningTag(
      html,
      "button",
      "data-ormo-password-field-toggle",
    );

    expect(root).toContain('data-state="hidden"');
    expect(root).toContain("data-hidden");
    expect(input).toContain('type="password"');
    expect(input).toContain('name="password"');
    expect(input).toContain('autocomplete="current-password"');
    expect(input).toContain('spellcheck="false"');
    expect(input).toContain('autocapitalize="none"');
    expect(input).toContain('autocorrect="off"');
    expect(toggle).toContain('type="button"');
    expect(toggle).toContain('aria-label="Show password"');
    expect(toggle).not.toContain("aria-pressed");
    expect(toggle).toContain('aria-controls="ormo-field-');
    expect(html).toContain("<script");
  });

  it("composes the Input with Field SSR relationships", async () => {
    const html = await container.renderToString(Default);
    const label = findOpeningTag(html, "label", "data-ormo-field-label");
    const input = findOpeningTag(
      html,
      "input",
      "data-ormo-password-field-input",
    );
    const labelFor = label.match(/for="([^"]+)"/)?.[1];

    expect(labelFor).toBeTruthy();
    expect(input).toContain(`id="${labelFor}"`);
    expect(input).toContain("data-ormo-input");
    expect(input).toContain("data-ormo-field-control");
  });

  it("supports an explicitly visible initial state", async () => {
    const html = await container.renderToString(Visible);
    const input = findOpeningTag(
      html,
      "input",
      "data-ormo-password-field-input",
    );
    const toggle = findOpeningTag(
      html,
      "button",
      "data-ormo-password-field-toggle",
    );

    expect(html).toContain('data-state="visible"');
    expect(input).toContain('type="text"');
    expect(toggle).toContain('aria-label="Hide password"');
    expect(toggle).not.toContain("aria-pressed");
  });

  it("renders an authored disabled toggle", async () => {
    const html = await container.renderToString(DisabledToggle);
    const toggle = findOpeningTag(
      html,
      "button",
      "data-ormo-password-field-toggle",
    );

    expect(toggle).toContain("disabled");
    expect(toggle).toContain("data-disabled");
  });

  it("does not render orphaned parts", async () => {
    const input = await container.renderToString(Input);
    const toggle = await container.renderToString(Toggle, {
      props: { showLabel: "Show", hideLabel: "Hide" },
    });

    expect(input).toBe("");
    expect(toggle).toBe("");
  });

  it("owns security and state attributes", async () => {
    const html = await container.renderToString(Default);
    const input = findOpeningTag(
      html,
      "input",
      "data-ormo-password-field-input",
    );
    const toggle = findOpeningTag(
      html,
      "button",
      "data-ormo-password-field-toggle",
    );

    expect(input.match(/\stype=/g)).toHaveLength(1);
    expect(input.match(/spellcheck=/g)).toHaveLength(1);
    expect(toggle.match(/\stype=/g)).toHaveLength(1);
    expect(toggle.match(/aria-controls=/g)).toHaveLength(1);
    expect(toggle.match(/aria-label=/g)).toHaveLength(1);
    expect(toggle).not.toContain("aria-pressed");
  });
});

describe("Password Field public types", () => {
  it("exposes typed parts and a visibility-only event", () => {
    expectTypeOf<PasswordFieldRootProps["defaultVisible"]>().toEqualTypeOf<
      boolean | undefined
    >();
    expectTypeOf<PasswordFieldInputProps["name"]>().toEqualTypeOf<
      string | null | undefined
    >();
    expectTypeOf<
      PasswordFieldToggleProps["showLabel"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      OrmoPasswordFieldElement["visible"]
    >().toEqualTypeOf<boolean>();
    expectTypeOf<PasswordVisibilityChangeDetail>().not.toHaveProperty("value");
  });
});
