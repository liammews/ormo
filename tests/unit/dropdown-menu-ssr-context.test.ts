import { expect, it } from "vitest";
import {
  getDropdownMenuSsrContext,
  renderWithDropdownMenuContext,
} from "../../src/internal/dropdown-menu-ssr-context";

it("isolates nested and concurrent roots", async () => {
  await Promise.all([
    renderWithDropdownMenuContext(
      { rootId: "one", defaultOpen: false, groupCount: 0 },
      async () => {
        expect(getDropdownMenuSsrContext()?.rootId).toBe("one");
        return "";
      },
    ),
    renderWithDropdownMenuContext(
      { rootId: "two", defaultOpen: true, groupCount: 0 },
      async () => {
        expect(getDropdownMenuSsrContext()?.rootId).toBe("two");
        return "";
      },
    ),
  ]);
  expect(getDropdownMenuSsrContext()).toBeUndefined();
});
