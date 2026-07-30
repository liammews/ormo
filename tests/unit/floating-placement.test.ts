import { describe, expect, it } from "vitest";

import {
  floatingPlacement,
  type FloatingAlign,
  type FloatingSide,
} from "../../src/internal/floating-placement";

describe("floating placement", () => {
  it("maps every side and alignment to logical Floating UI placement", () => {
    const sides: FloatingSide[] = ["top", "right", "bottom", "left"];
    const alignments: FloatingAlign[] = ["start", "center", "end"];

    for (const direction of ["ltr", "rtl"] as const) {
      document.documentElement.dir = direction;

      for (const side of sides) {
        for (const align of alignments) {
          expect(floatingPlacement(side, align)).toBe(
            align === "center" ? side : `${side}-${align}`,
          );
        }
      }
    }
  });
});
