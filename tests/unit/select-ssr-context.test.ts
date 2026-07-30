import { describe, expect, it } from "vitest";

import {
  getSelectGroupSsrContext,
  getSelectSsrContext,
  htmlToText,
  renderWithSelectContext,
  renderWithSelectGroupContext,
  type SelectSsrContext,
} from "../../src/internal/select-ssr-context";

function context(rootId: string): SelectSsrContext {
  return {
    native: false,
    rootId,
    defaultValue: "",
    items: [],
    groupCount: 0,
  };
}

describe("select SSR context", () => {
  it("extracts text with complete named, decimal and hexadecimal entities", () => {
    expect(
      htmlToText(
        "<span>Caf&eacute;</span>&nbsp;&#169; &#x1F680; &NotEqualTilde;",
      ),
    ).toBe("Café © 🚀 ≂̸");
    expect(htmlToText("  Alpha\n <strong> Beta </strong>  Gamma ")).toBe(
      "Alpha Beta Gamma",
    );
  });

  it("isolates nested select and group contexts across concurrent renders", async () => {
    const seen: Array<Array<string | undefined>> = [];
    await Promise.all(
      ["first", "second"].map((rootId) =>
        renderWithSelectContext(context(rootId), async () => {
          await Promise.resolve();
          return renderWithSelectGroupContext(
            {
              id: `${rootId}-group`,
              labelId: `${rootId}-label`,
              label: rootId,
            },
            async () => {
              seen.push([
                getSelectSsrContext()?.rootId,
                getSelectGroupSsrContext()?.id,
              ]);
              return "";
            },
          );
        }),
      ),
    );

    expect(seen).toEqual(
      expect.arrayContaining([
        ["first", "first-group"],
        ["second", "second-group"],
      ]),
    );
    expect(getSelectSsrContext()).toBeUndefined();
    expect(getSelectGroupSsrContext()).toBeUndefined();
  });
});
