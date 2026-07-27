import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AvatarLoadingStatusChangeEvent,
  ImageLoadingStatus,
  OrmoAvatarElement,
} from "../../src/components/avatar/types";
import "../../src/runtime/avatar";

interface AvatarOptions {
  alt?: string | null;
  delay?: number;
  fallback?: string;
  /** When false, the image reports as still loading (`complete === false`). */
  complete?: boolean;
  naturalWidth?: number;
  src?: string | null;
  srcset?: string;
}

function createAvatar(options: AvatarOptions = {}): OrmoAvatarElement {
  const root = document.createElement("ormo-avatar") as OrmoAvatarElement;
  root.setAttribute("data-ormo-avatar-root", "");

  const parts: string[] = [];
  const resolvedSrc =
    options.src === null
      ? null
      : options.src === undefined
        ? "https://example.com/ada.jpg"
        : options.src;

  if (resolvedSrc !== null) {
    const altAttribute =
      options.alt === null ? "" : `alt="${options.alt ?? "Ada Lovelace"}"`;
    const srcAttr = resolvedSrc ? `src="${resolvedSrc}"` : "";
    const srcsetAttr = options.srcset ? `srcset="${options.srcset}"` : "";
    parts.push(
      `<img data-ormo-avatar-image ${srcAttr} ${srcsetAttr} ${altAttribute}>`,
    );
  }

  const delayAttr =
    options.delay !== undefined ? `data-delay="${options.delay}"` : "";
  const hiddenAttr = options.delay ? "hidden" : "";
  parts.push(
    `<span data-ormo-avatar-fallback ${delayAttr} ${hiddenAttr}>${options.fallback ?? "AL"}</span>`,
  );

  root.innerHTML = parts.join("");

  const image = root.querySelector<HTMLImageElement>(
    "[data-ormo-avatar-image]",
  );
  if (image && resolvedSrc) {
    const complete = options.complete ?? false;
    const naturalWidth = options.naturalWidth ?? (complete ? 48 : 0);
    Object.defineProperty(image, "complete", {
      configurable: true,
      get: () => complete,
    });
    Object.defineProperty(image, "naturalWidth", {
      configurable: true,
      get: () => naturalWidth,
    });
  }

  document.body.append(root);
  return root;
}

function getImage(root: OrmoAvatarElement): HTMLImageElement | null {
  return root.querySelector("[data-ormo-avatar-image]");
}

function getFallback(root: OrmoAvatarElement): HTMLElement {
  const fallback = root.querySelector<HTMLElement>(
    "[data-ormo-avatar-fallback]",
  );
  if (!fallback) {
    throw new Error("Expected avatar fallback");
  }
  return fallback;
}

function setImageState(
  image: HTMLImageElement,
  result: "loading" | "loaded" | "error",
): void {
  Object.defineProperty(image, "complete", {
    configurable: true,
    get: () => result !== "loading",
  });
  Object.defineProperty(image, "naturalWidth", {
    configurable: true,
    get: () => (result === "loaded" ? 48 : 0),
  });
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("avatar", () => {
  it("exposes error status and shows fallback when no image is present", () => {
    const root = createAvatar({ src: null });
    const fallback = getFallback(root);

    expect(root.imageLoadingStatus).toBe("error");
    expect(root.dataset.status).toBe("error");
    expect(fallback.hidden).toBe(false);
  });

  it("exposes error status when the image has no source", () => {
    const root = createAvatar({ src: "" });
    const image = getImage(root);
    const fallback = getFallback(root);

    expect(root.imageLoadingStatus).toBe("error");
    expect(image?.hidden).toBe(true);
    expect(fallback.hidden).toBe(false);
  });

  it("treats whitespace-only src as missing", () => {
    const root = createAvatar({ src: "   " });
    const image = getImage(root);
    const fallback = getFallback(root);

    expect(root.imageLoadingStatus).toBe("error");
    expect(image?.hidden).toBe(true);
    expect(fallback.hidden).toBe(false);
  });

  it("moves to loaded and hides the fallback when the image loads", () => {
    const root = createAvatar({ complete: false });
    const image = getImage(root);
    const fallback = getFallback(root);

    expect(image).not.toBeNull();
    if (!image) return;

    expect(root.imageLoadingStatus).toBe("loading");
    expect(fallback.hidden).toBe(false);

    setImageState(image, "loaded");
    image.dispatchEvent(new Event("load", { bubbles: true }));

    expect(root.imageLoadingStatus).toBe("loaded");
    expect(root.dataset.status).toBe("loaded");
    expect(image.hidden).toBe(false);
    expect(fallback.hidden).toBe(true);
  });

  it("shows the fallback when the image errors", () => {
    const root = createAvatar({ complete: false });
    const image = getImage(root);
    const fallback = getFallback(root);

    expect(image).not.toBeNull();
    if (!image) return;

    setImageState(image, "error");
    image.dispatchEvent(new Event("error", { bubbles: true }));

    expect(root.imageLoadingStatus).toBe("error");
    expect(image.hidden).toBe(true);
    expect(fallback.hidden).toBe(false);
  });

  it("delays showing the fallback while loading", () => {
    vi.useFakeTimers();
    const root = createAvatar({ complete: false, delay: 600 });
    const fallback = getFallback(root);

    expect(root.imageLoadingStatus).toBe("loading");
    expect(fallback.hidden).toBe(true);

    vi.advanceTimersByTime(599);
    expect(fallback.hidden).toBe(true);

    vi.advanceTimersByTime(1);
    expect(fallback.hidden).toBe(false);
  });

  it("uses an increased delay from the start of the current load", async () => {
    vi.useFakeTimers();
    const root = createAvatar({ complete: false, delay: 600 });
    const fallback = getFallback(root);

    vi.advanceTimersByTime(100);
    fallback.dataset.delay = "1000";
    await flushMicrotasks();

    vi.advanceTimersByTime(899);
    expect(fallback.hidden).toBe(true);

    vi.advanceTimersByTime(1);
    expect(fallback.hidden).toBe(false);
  });

  it("uses a decreased delay from the start of the current load", async () => {
    vi.useFakeTimers();
    const root = createAvatar({ complete: false, delay: 600 });
    const fallback = getFallback(root);

    vi.advanceTimersByTime(100);
    fallback.dataset.delay = "200";
    await flushMicrotasks();

    vi.advanceTimersByTime(99);
    expect(fallback.hidden).toBe(true);

    vi.advanceTimersByTime(1);
    expect(fallback.hidden).toBe(false);
  });

  it("does not show a delayed fallback after the image has loaded", () => {
    vi.useFakeTimers();
    const root = createAvatar({ complete: false, delay: 600 });
    const image = getImage(root);
    const fallback = getFallback(root);

    expect(image).not.toBeNull();
    if (!image) return;

    setImageState(image, "loaded");
    image.dispatchEvent(new Event("load", { bubbles: true }));

    vi.advanceTimersByTime(600);

    expect(root.imageLoadingStatus).toBe("loaded");
    expect(fallback.hidden).toBe(true);
    expect(image.hidden).toBe(false);
  });

  it("re-evaluates status when the image src changes", async () => {
    const root = createAvatar({ complete: false });
    const image = getImage(root);
    const fallback = getFallback(root);

    expect(image).not.toBeNull();
    if (!image) return;

    setImageState(image, "loaded");
    image.dispatchEvent(new Event("load", { bubbles: true }));
    expect(root.imageLoadingStatus).toBe("loaded");

    setImageState(image, "loading");
    image.setAttribute("src", "https://example.com/ada-2.jpg");
    await flushMicrotasks();

    expect(root.imageLoadingStatus).toBe("loading");
    expect(image.hidden).toBe(true);
    expect(fallback.hidden).toBe(false);
  });

  it("dispatches ormo:avatar-loading-status-change when status changes", () => {
    const root = createAvatar({ complete: false });
    const image = getImage(root);
    const statuses: ImageLoadingStatus[] = [];

    root.addEventListener("ormo:avatar-loading-status-change", (event) => {
      statuses.push((event as AvatarLoadingStatusChangeEvent).detail.status);
    });

    expect(image).not.toBeNull();
    if (!image) return;

    setImageState(image, "loaded");
    image.dispatchEvent(new Event("load", { bubbles: true }));

    expect(statuses).toEqual(["loaded"]);
  });

  it("forwards native image attributes", () => {
    const root = createAvatar({
      alt: "Ada Lovelace",
      complete: false,
      src: "https://example.com/ada.jpg",
    });
    const image = getImage(root);

    expect(image?.getAttribute("alt")).toBe("Ada Lovelace");
    expect(image?.getAttribute("src")).toBe("https://example.com/ada.jpg");
    expect(image?.hasAttribute("data-ormo-avatar-image")).toBe(true);
  });

  it("warns in development when Image is missing alt", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    createAvatar({ alt: null, complete: false });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Avatar.Image needs an alt attribute"),
      expect.any(HTMLImageElement),
    );

    warn.mockRestore();
  });
});
