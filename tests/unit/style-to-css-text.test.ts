import { describe, expect, it } from "vitest";
import { styleToCssText } from "../../src/internal/style-to-css-text";

describe("styleToCssText", () => {
  it("preserves and trims authored CSS text", () => {
    expect(styleToCssText(" color: red; ")).toBe("color: red;");
  });

  it("serialises Astro style objects", () => {
    expect(
      styleToCssText({
        backgroundColor: "red",
        "--consumer-offset": "1rem",
        opacity: 0,
        ignored: null,
      }),
    ).toBe("background-color: red; --consumer-offset: 1rem; opacity: 0");
  });

  it("ignores unsupported and absent values", () => {
    expect(styleToCssText(undefined)).toBe("");
    expect(styleToCssText(false)).toBe("");
    expect(styleToCssText(42)).toBe("");
  });
});
