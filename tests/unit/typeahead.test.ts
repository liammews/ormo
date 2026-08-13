import { afterEach, describe, expect, it, vi } from "vitest";

import { Typeahead } from "../../src/runtime/typeahead";

afterEach(() => vi.useRealTimers());

describe("Typeahead", () => {
  it("builds and resets a case-insensitive search query", () => {
    vi.useFakeTimers();
    const typeahead = new Typeahead();
    const items = ["Apple", "Apricot", "Banana"];

    expect(typeahead.search("a", items, (item) => item)).toBe("Apple");
    expect(typeahead.search("p", items, (item) => item)).toBe("Apple");

    vi.advanceTimersByTime(700);
    expect(typeahead.search("b", items, (item) => item)).toBe("Banana");
  });
});
