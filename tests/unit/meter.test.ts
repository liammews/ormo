import { describe, expect, it } from "vitest";

describe("native meter state", () => {
  it("supports dynamic value and range attributes", () => {
    const meter = document.createElement("meter");

    meter.setAttribute("min", "0");
    meter.setAttribute("max", "100");
    meter.setAttribute("value", "72");
    meter.setAttribute("low", "25");
    meter.setAttribute("high", "80");
    meter.setAttribute("optimum", "60");

    expect(meter.getAttribute("min")).toBe("0");
    expect(meter.getAttribute("max")).toBe("100");
    expect(meter.getAttribute("value")).toBe("72");
    expect(meter.getAttribute("low")).toBe("25");
    expect(meter.getAttribute("high")).toBe("80");
    expect(meter.getAttribute("optimum")).toBe("60");

    meter.setAttribute("value", "81");
    expect(meter.getAttribute("value")).toBe("81");
  });

  it("supports accessible naming and value text", () => {
    const meter = document.createElement("meter");
    meter.setAttribute("aria-label", "Storage used");
    meter.setAttribute("aria-valuetext", "72 gigabytes used");

    expect(meter.getAttribute("aria-label")).toBe("Storage used");
    expect(meter.getAttribute("aria-valuetext")).toBe("72 gigabytes used");
  });
});
