import { experimental_AstroContainer } from "astro/container";
import { beforeAll, describe, expect, expectTypeOf, it } from "vitest";

import Input from "../../src/components/input/Input.astro";
import type { InputProps, InputType } from "../../src/components/input/types";
import FieldComposition from "../fixtures/input/FieldComposition.astro";
import { findOpeningTag } from "./helpers/astro";

describe("Input markup", () => {
  let container: Awaited<ReturnType<typeof experimental_AstroContainer.create>>;

  beforeAll(async () => {
    container = await experimental_AstroContainer.create();
  });

  it("renders a native input and forwards native form attributes", async () => {
    const html = await container.renderToString(Input, {
      props: {
        id: "account-email",
        name: "email",
        type: "email",
        value: "person@example.com",
        autocomplete: "email",
        required: true,
        form: "account-form",
        "aria-describedby": "account-email-hint",
      },
    });
    const input = findOpeningTag(html, "input", "data-ormo-input");

    expect(input).toContain('id="account-email"');
    expect(input).toContain('name="email"');
    expect(input).toContain('type="email"');
    expect(input).toContain('value="person@example.com"');
    expect(input).toContain('autocomplete="email"');
    expect(input).toContain("required");
    expect(input).toContain('form="account-form"');
    expect(input).toContain('aria-describedby="account-email-hint"');
    expect(input).not.toContain("data-ormo-field-control");
  });

  it("owns its component marker", async () => {
    const html = await container.renderToString(Input, {
      props: { "data-ormo-input": "spoofed" },
    });
    const input = findOpeningTag(html, "input", "data-ormo-input");

    expect(input.match(/data-ormo-input(?:=|\s|>)/g)).toHaveLength(1);
    expect(input).not.toContain('data-ormo-input="spoofed"');
  });

  it("inherits Field relationships and invalid state during SSR", async () => {
    const html = await container.renderToString(FieldComposition);
    const label = findOpeningTag(html, "label", "data-ormo-field-label");
    const input = findOpeningTag(html, "input", "data-ormo-input");

    expect(label).toContain('for="profile-email-field-control"');
    expect(input).toContain('id="profile-email-field-control"');
    expect(input).toContain("data-ormo-field-control");
    expect(input).toContain("data-ormo-field-inherited-invalid");
    expect(input).toContain("data-invalid");
    expect(input).toContain('aria-invalid="true"');
  });
});

describe("Input public types", () => {
  it("supports text-entry input types and excludes specialized controls", () => {
    expectTypeOf<InputProps["type"]>().toEqualTypeOf<InputType | undefined>();
    expectTypeOf<Extract<InputType, "email">>().toEqualTypeOf<"email">();
    expectTypeOf<Extract<InputType, "checkbox">>().toEqualTypeOf<never>();
    expectTypeOf<Extract<InputType, "radio">>().toEqualTypeOf<never>();
    expectTypeOf<Extract<InputType, "submit">>().toEqualTypeOf<never>();
  });
});
