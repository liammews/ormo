import { describe, expect, it } from "vitest";

import {
  getFieldSsrContext,
  renderWithFieldContext,
} from "../../src/internal/field-ssr-context";

describe("field SSR context", () => {
  it("isolates nested and concurrent renders", async () => {
    const seen: Array<Array<string | undefined>> = [];
    await Promise.all(
      ["first", "second"].map((rootId) =>
        renderWithFieldContext(
          {
            invalid: rootId === "second",
            rootId,
            controlId: `${rootId}-control`,
            labelCount: 0,
            descriptionCount: 0,
            errorCount: 0,
          },
          async () => {
            await Promise.resolve();
            const outer = getFieldSsrContext()?.rootId;
            let inner: string | undefined;
            await renderWithFieldContext(
              {
                invalid: false,
                rootId: `${rootId}-nested`,
                controlId: `${rootId}-nested-control`,
                labelCount: 0,
                descriptionCount: 0,
                errorCount: 0,
              },
              async () => {
                inner = getFieldSsrContext()?.rootId;
                return "";
              },
            );
            seen.push([outer, inner, getFieldSsrContext()?.rootId]);
            return "";
          },
        ),
      ),
    );

    expect(seen).toEqual(
      expect.arrayContaining([
        ["first", "first-nested", "first"],
        ["second", "second-nested", "second"],
      ]),
    );
    expect(getFieldSsrContext()).toBeUndefined();
  });
});
