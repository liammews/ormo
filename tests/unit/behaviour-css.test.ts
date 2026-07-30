import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("behaviour CSS", () => {
  it("positions anchored content for every side, alignment and direction", () => {
    const positionAreas = {
      bottom: {
        start: "bottom span-right",
        center: "bottom center",
        end: "bottom span-left",
      },
      top: {
        start: "top span-right",
        center: "top center",
        end: "top span-left",
      },
      right: {
        start: "right span-bottom",
        center: "right center",
        end: "right span-top",
      },
      left: {
        start: "left span-bottom",
        center: "left center",
        end: "left span-top",
      },
    } as const;

    for (const primitive of ["select", "popover", "tooltip"]) {
      const css = readFileSync(resolve(`src/runtime/${primitive}.css`), "utf8");

      for (const direction of ["ltr", "rtl"]) {
        for (const [side, alignments] of Object.entries(positionAreas)) {
          for (const [align, positionArea] of Object.entries(alignments)) {
            const rule = new RegExp(
              String.raw`data-side="${side}"\]\[data-align="${align}"\][^{]*\{[^}]*position-area:\s*${positionArea};`,
            );
            expect(css, `${primitive}/${direction}/${side}/${align}`).toMatch(
              rule,
            );
          }
        }
      }
    }
  });
});
