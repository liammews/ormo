import { describe, expect, it } from "vitest";

describe("native progress state", () => {
  it("supports dynamic determinate and indeterminate updates", () => {
    const progress = document.createElement("progress");

    expect(progress.hasAttribute("value")).toBe(false);
    progress.max = 10;
    progress.value = 4;
    expect(progress.value).toBe(4);
    expect(progress.max).toBe(10);
    expect(progress.getAttribute("value")).toBe("4");

    progress.removeAttribute("value");
    expect(progress.hasAttribute("value")).toBe(false);
  });

  it("supports dynamic accessible value text", () => {
    const progress = document.createElement("progress");
    progress.setAttribute("aria-label", "File upload");
    progress.setAttribute("aria-valuetext", "Scanning files");

    expect(progress.getAttribute("aria-label")).toBe("File upload");
    expect(progress.getAttribute("aria-valuetext")).toBe("Scanning files");

    progress.setAttribute("aria-valuetext", "4 of 10 files");
    expect(progress.getAttribute("aria-valuetext")).toBe("4 of 10 files");
  });
});
