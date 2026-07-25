import { describe, expect, it } from "vitest";

import {
  claimBreadcrumbPosition,
  getBreadcrumbsListSsrContext,
  getBreadcrumbsRootSsrContext,
  renderWithBreadcrumbsListContext,
  renderWithBreadcrumbsRootContext,
} from "../../src/internal/breadcrumbs-ssr-context";

describe("breadcrumbs SSR context", () => {
  it("exposes root microdata to nested renders", async () => {
    let seenMicrodata: boolean | undefined;

    await renderWithBreadcrumbsRootContext({ microdata: true }, async () => {
      seenMicrodata = getBreadcrumbsRootSsrContext()?.microdata;
      return "";
    });

    expect(seenMicrodata).toBe(true);
    expect(getBreadcrumbsRootSsrContext()).toBeUndefined();
  });

  it("claims positions in document order within a list", async () => {
    const list = { microdata: true, nextPosition: 0 };
    const positions: number[] = [];

    await renderWithBreadcrumbsListContext(list, async () => {
      positions.push(claimBreadcrumbPosition(list));
      positions.push(claimBreadcrumbPosition(list));
      positions.push(claimBreadcrumbPosition(list));
      return "";
    });

    expect(positions).toEqual([1, 2, 3]);
    expect(list.nextPosition).toBe(3);
    expect(getBreadcrumbsListSsrContext()).toBeUndefined();
  });

  it("keeps separate counters for nested list contexts", async () => {
    const outer = { microdata: true, nextPosition: 0 };
    const inner = { microdata: true, nextPosition: 0 };

    await renderWithBreadcrumbsListContext(outer, async () => {
      expect(claimBreadcrumbPosition(outer)).toBe(1);

      await renderWithBreadcrumbsListContext(inner, async () => {
        expect(claimBreadcrumbPosition(inner)).toBe(1);
        expect(claimBreadcrumbPosition(inner)).toBe(2);
        expect(getBreadcrumbsListSsrContext()).toBe(inner);
        return "";
      });

      expect(claimBreadcrumbPosition(outer)).toBe(2);
      expect(getBreadcrumbsListSsrContext()).toBe(outer);
      return "";
    });

    expect(outer.nextPosition).toBe(2);
    expect(inner.nextPosition).toBe(2);
  });
});
