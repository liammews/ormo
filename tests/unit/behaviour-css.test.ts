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

  it("leaves popup presentation to consumer styles in any cascade layer", () => {
    const presentational =
      /(?:^|[;{\s])(?:background(?:-color)?|color|border(?:-[a-z-]+)?|padding(?:-[a-z-]+)?|overflow(?:-[xy])?|margin):/;

    for (const primitive of [
      "autocomplete",
      "combobox",
      "dropdown-menu",
      "navigation-menu",
      "popover",
      "preview-card",
      "select",
      "tooltip",
    ]) {
      const css = readFileSync(resolve(`src/runtime/${primitive}.css`), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/@supports[^{]*\{/g, "");
      const contentRules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
        .map(([, selector = "", body = ""]) => ({ selector, body }))
        .filter(({ selector }) =>
          selector.includes(`[data-ormo-${primitive}-content`),
        );

      expect(contentRules.length, primitive).toBeGreaterThan(0);
      for (const { selector, body } of contentRules) {
        // Floating UI coordinates need a zero margin. Other popup margins are
        // sideOffset longhands, which are not matched here.
        if (selector.includes("-positioning=")) continue;
        expect(body, `${primitive}: ${selector.trim()}`).not.toMatch(
          presentational,
        );
      }
    }
  });
});
