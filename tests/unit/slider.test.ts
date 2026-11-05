import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrmoSliderElement } from "../../src/components/slider/types";
import "../../src/runtime/slider";
import { validateSlider } from "../../src/runtime/slider";

function slider(
  options: {
    values?: number[];
    controlled?: boolean;
    disabled?: boolean;
  } = {},
): OrmoSliderElement {
  const root = document.createElement("ormo-slider");
  root.dataset.value = JSON.stringify(options.values ?? [20, 80]);
  root.dataset.defaultValue = root.dataset.value;
  root.dataset.min = "0";
  root.dataset.max = "100";
  root.dataset.step = "5";
  root.dataset.orientation = "horizontal";
  root.toggleAttribute("data-controlled", options.controlled ?? false);
  root.toggleAttribute("data-disabled", options.disabled ?? false);
  root.innerHTML = (options.values ?? [20, 80])
    .map(
      (value, index) =>
        `<input type="range" value="${value}" aria-label="Thumb ${index + 1}" data-ormo-slider-thumb>`,
    )
    .join("");
  document.body.append(root);
  return root;
}

function thumbs(root: Element): HTMLInputElement[] {
  return Array.from(root.querySelectorAll("[data-ormo-slider-thumb]"));
}

function input(thumb: HTMLInputElement, value: number): void {
  thumb.value = String(value);
  thumb.dispatchEvent(new Event("input", { bubbles: true }));
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("Slider runtime", () => {
  it("updates an uncontrolled value and geometry", () => {
    const root = slider();
    const listener = vi.fn();
    root.addEventListener("ormo:value-change", listener);

    input(thumbs(root)[0]!, 30);

    expect(root.value).toEqual([30, 80]);
    expect(root.style.getPropertyValue("--ormo-slider-start")).toBe("30%");
    expect(listener.mock.calls[0]?.[0].detail).toEqual({
      value: [30, 80],
      previousValue: [20, 80],
      thumbIndex: 0,
      reason: "input",
    });
  });

  it("waits for controlled assignment and supports cancellation", () => {
    const controlled = slider({ controlled: true });
    input(thumbs(controlled)[0]!, 30);
    expect(controlled.value).toEqual([20, 80]);
    expect(thumbs(controlled)[0]!.valueAsNumber).toBe(20);

    const cancelled = slider();
    cancelled.addEventListener("ormo:value-change", (event) =>
      event.preventDefault(),
    );
    input(thumbs(cancelled)[0]!, 30);
    expect(cancelled.value).toEqual([20, 80]);
  });

  it("keeps a shared scale and prevents thumbs from crossing", () => {
    const root = slider();
    const [minimum, maximum] = thumbs(root);

    expect(minimum!.max).toBe("100");
    expect(maximum!.min).toBe("0");
    input(minimum!, 100);
    expect(root.value).toEqual([80, 80]);
  });

  it("updates range properties, orientation, disabled state, and values", () => {
    const root = slider({ values: [25] });
    root.min = 10;
    root.max = 50;
    root.step = 2;
    root.orientation = "vertical";
    root.disabled = true;
    root.value = [40];
    const thumb = thumbs(root)[0]!;

    expect(thumb.min).toBe("10");
    expect(thumb.max).toBe("50");
    expect(thumb.step).toBe("2");
    expect(thumb.valueAsNumber).toBe(40);
    expect(thumb.disabled).toBe(true);
    expect(thumb.getAttribute("aria-orientation")).toBe("vertical");
  });

  it("scopes nested sliders", () => {
    const outer = slider({ values: [20] });
    const inner = slider({ values: [60] });
    outer.append(inner);

    input(thumbs(inner)[0]!, 70);

    expect(inner.value).toEqual([70]);
    expect(outer.value).toEqual([20]);
  });
});

describe("Slider RTL arrow keys", () => {
  function rtl(root: OrmoSliderElement): OrmoSliderElement {
    const wrapper = document.createElement("div");
    wrapper.style.direction = "rtl";
    document.body.append(wrapper);
    wrapper.append(root);
    return root;
  }

  function press(thumb: HTMLInputElement, key: string, init = {}): boolean {
    return thumb.dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  }

  it("moves with the arrow and emits native input and change events", () => {
    const root = rtl(slider({ values: [20] }));
    const thumb = thumbs(root)[0]!;
    const changes = vi.fn();
    const valueChanges = vi.fn();
    thumb.addEventListener("change", changes);
    root.addEventListener("ormo:value-change", valueChanges);

    expect(press(thumb, "ArrowRight")).toBe(false);
    expect(root.value).toEqual([15]);
    expect(press(thumb, "ArrowLeft")).toBe(false);
    expect(press(thumb, "ArrowLeft")).toBe(false);
    expect(root.value).toEqual([25]);
    expect(changes).toHaveBeenCalledTimes(3);
    expect(valueChanges.mock.calls[0]?.[0].detail).toEqual({
      value: [15],
      previousValue: [20],
      thumbIndex: 0,
      reason: "input",
    });
  });

  it("clamps to bounds and neighbouring thumbs", () => {
    const bounded = rtl(slider({ values: [0] }));
    const listener = vi.fn();
    bounded.addEventListener("ormo:value-change", listener);
    expect(press(thumbs(bounded)[0]!, "ArrowRight")).toBe(false);
    expect(bounded.value).toEqual([0]);
    expect(listener).not.toHaveBeenCalled();

    const range = rtl(slider({ values: [20, 25] }));
    press(thumbs(range)[0]!, "ArrowLeft");
    press(thumbs(range)[0]!, "ArrowLeft");
    expect(range.value).toEqual([25, 25]);
  });

  it("keeps controlled and cancelled values", () => {
    const controlled = rtl(slider({ values: [20], controlled: true }));
    press(thumbs(controlled)[0]!, "ArrowLeft");
    expect(controlled.value).toEqual([20]);
    expect(thumbs(controlled)[0]!.valueAsNumber).toBe(20);

    const cancelled = rtl(slider({ values: [20] }));
    cancelled.addEventListener("ormo:value-change", (event) =>
      event.preventDefault(),
    );
    press(thumbs(cancelled)[0]!, "ArrowLeft");
    expect(cancelled.value).toEqual([20]);
  });

  it("leaves LTR, vertical, modified, prevented and other keys native", () => {
    const ltr = slider({ values: [20] });
    expect(press(thumbs(ltr)[0]!, "ArrowRight")).toBe(true);

    const vertical = rtl(slider({ values: [20] }));
    vertical.orientation = "vertical";
    expect(press(thumbs(vertical)[0]!, "ArrowRight")).toBe(true);

    const root = rtl(slider({ values: [20] }));
    const thumb = thumbs(root)[0]!;
    expect(press(thumb, "ArrowRight", { ctrlKey: true })).toBe(true);
    expect(press(thumb, "ArrowUp")).toBe(true);
    expect(press(thumb, "Home")).toBe(true);
    thumb.addEventListener("keydown", (event) => event.preventDefault(), {
      once: true,
    });
    press(thumb, "ArrowRight");
    expect(root.value).toEqual([20]);
  });

  it("ignores disabled sliders and thumbs of nested sliders", () => {
    const disabled = rtl(slider({ values: [20], disabled: true }));
    expect(press(thumbs(disabled)[0]!, "ArrowLeft")).toBe(true);

    const outer = rtl(slider({ values: [20] }));
    const inner = slider({ values: [60] });
    outer.append(inner);
    press(thumbs(inner)[0]!, "ArrowLeft");
    expect(inner.value).toEqual([65]);
    expect(outer.value).toEqual([20]);
  });
});

describe("Slider diagnostics", () => {
  it("warns about missing thumbs and accessible names", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const empty = document.createElement("ormo-slider");
    validateSlider(empty);
    expect(warn).toHaveBeenCalledWith(
      "[Ormo Slider] Add at least one Thumb.",
      empty,
    );

    const root = slider({ values: [20] });
    thumbs(root)[0]!.removeAttribute("aria-label");
    validateSlider(root);
    expect(warn).toHaveBeenCalledWith(
      "[Ormo Slider] Give every Thumb an accessible name.",
      thumbs(root)[0],
    );
  });
});
