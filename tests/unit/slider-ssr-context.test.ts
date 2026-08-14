import { describe, expect, it } from "vitest";
import {
  getSliderSsrContext,
  renderWithSliderContext,
  type SliderSsrContext,
} from "../../src/internal/slider-ssr-context";

function context(values: number[]): SliderSsrContext {
  return {
    values,
    min: 0,
    max: 100,
    step: 1,
    disabled: false,
    orientation: "horizontal",
    name: undefined,
    form: undefined,
    thumbIndex: 0,
  };
}

describe("Slider SSR context", () => {
  it("isolates nested contexts", async () => {
    const outer = context([20, 80]);
    await renderWithSliderContext(outer, async () => {
      expect(getSliderSsrContext()).toBe(outer);
      const inner = context([50]);
      await renderWithSliderContext(inner, async () => {
        expect(getSliderSsrContext()).toBe(inner);
        return "";
      });
      expect(getSliderSsrContext()).toBe(outer);
      return "";
    });
    expect(getSliderSsrContext()).toBeUndefined();
  });
});
