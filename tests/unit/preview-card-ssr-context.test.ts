import { expect, it } from "vitest";
import {
  getPreviewCardSsrContext,
  renderWithPreviewCardContext,
} from "../../src/internal/preview-card-ssr-context";

it("isolates concurrent preview roots", async () => {
  await Promise.all([
    renderWithPreviewCardContext(
      { rootId: "one", defaultOpen: false },
      async () => {
        expect(getPreviewCardSsrContext()?.rootId).toBe("one");
        return "";
      },
    ),
    renderWithPreviewCardContext(
      { rootId: "two", defaultOpen: true },
      async () => {
        expect(getPreviewCardSsrContext()?.rootId).toBe("two");
        return "";
      },
    ),
  ]);
  expect(getPreviewCardSsrContext()).toBeUndefined();
});
