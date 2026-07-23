import { describe, expect, it } from "vitest";

import {
  getAccordionItemSsrContext,
  getAccordionSsrContext,
  normalizeDefaultOpenValues,
  renderWithAccordionContext,
  renderWithAccordionItemContext,
} from "../../src/internal/accordion-ssr-context";

describe("accordion SSR context", () => {
  it("normalizes single and multiple default values", () => {
    expect(normalizeDefaultOpenValues("single", undefined)).toEqual(new Set());
    expect(normalizeDefaultOpenValues("single", "about")).toEqual(
      new Set(["about"]),
    );
    expect(normalizeDefaultOpenValues("single", ["about", "price"])).toEqual(
      new Set(["about"]),
    );
    expect(normalizeDefaultOpenValues("multiple", "about")).toEqual(
      new Set(["about"]),
    );
    expect(normalizeDefaultOpenValues("multiple", ["about", "price"])).toEqual(
      new Set(["about", "price"]),
    );
  });

  it("scopes nested accordion and item contexts during render", async () => {
    const seen: Array<{
      accordionType: string | undefined;
      itemOpen: boolean | undefined;
    }> = [];

    await renderWithAccordionContext(
      {
        type: "single",
        collapsible: false,
        openValues: new Set(["outer"]),
        hiddenUntilFound: false,
      },
      async () => {
        await renderWithAccordionItemContext({ open: true }, async () => {
          seen.push({
            accordionType: getAccordionSsrContext()?.type,
            itemOpen: getAccordionItemSsrContext()?.open,
          });

          await renderWithAccordionContext(
            {
              type: "multiple",
              collapsible: true,
              openValues: new Set(["inner"]),
              hiddenUntilFound: true,
            },
            async () => {
              await renderWithAccordionItemContext(
                { open: false },
                async () => {
                  seen.push({
                    accordionType: getAccordionSsrContext()?.type,
                    itemOpen: getAccordionItemSsrContext()?.open,
                  });
                  return "";
                },
              );
              return "";
            },
          );

          seen.push({
            accordionType: getAccordionSsrContext()?.type,
            itemOpen: getAccordionItemSsrContext()?.open,
          });
          return "";
        });
        return "";
      },
    );

    expect(seen).toEqual([
      { accordionType: "single", itemOpen: true },
      { accordionType: "multiple", itemOpen: false },
      { accordionType: "single", itemOpen: true },
    ]);
  });
});
