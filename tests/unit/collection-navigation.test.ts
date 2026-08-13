import { afterEach, describe, expect, it } from "vitest";

import {
  getCollectionItems,
  moveCollectionItem,
  setRovingTabStop,
} from "../../src/runtime/collection-navigation";

afterEach(() => document.body.replaceChildren());

describe("collection navigation", () => {
  it("returns owned items in DOM order", () => {
    const root = document.createElement("div");
    root.innerHTML = `<button data-item>one</button><div><button data-item>two</button></div>`;

    expect(
      getCollectionItems<HTMLButtonElement>(
        root,
        "[data-item]",
        (item) => item.textContent !== "one",
      ).map((item) => item.textContent),
    ).toEqual(["two"]);
  });

  it("moves, clamps, and loops through ordered items", () => {
    const items = ["one", "two", "three"];

    expect(moveCollectionItem({ items, current: undefined, delta: 1 })).toBe(
      "one",
    );
    expect(moveCollectionItem({ items, current: undefined, delta: -1 })).toBe(
      "three",
    );
    expect(moveCollectionItem({ items, current: "three", delta: 1 })).toBe(
      "three",
    );
    expect(
      moveCollectionItem({
        items,
        current: "three",
        delta: 1,
        loop: true,
      }),
    ).toBe("one");
  });

  it("sets one roving tab stop", () => {
    const first = document.createElement("button");
    const second = document.createElement("button");

    setRovingTabStop([first, second], second);

    expect(first.tabIndex).toBe(-1);
    expect(second.tabIndex).toBe(0);
  });
});
