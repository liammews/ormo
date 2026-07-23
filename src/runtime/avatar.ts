import type {
  ImageLoadingStatus,
  OrmoAvatarElement,
} from "../components/avatar/types";

const tagName = "ormo-avatar";
const imageSelector = "[data-ormo-avatar-image]";
const fallbackSelector = "[data-ormo-avatar-fallback]";

function belongsToRoot(element: Element, root: HTMLElement): boolean {
  return element.closest(tagName) === root;
}

function hasImageSource(image: HTMLImageElement): boolean {
  return Boolean(
    image.getAttribute("src")?.trim() || image.getAttribute("srcset")?.trim(),
  );
}

function readImageStatus(image: HTMLImageElement): ImageLoadingStatus {
  if (!hasImageSource(image)) {
    return "error";
  }

  if (image.complete) {
    return image.naturalWidth > 0 ? "loaded" : "error";
  }

  return "loading";
}

function parseDelay(fallback: HTMLElement): number {
  const raw = fallback.dataset.delay;
  if (raw === undefined) {
    return 0;
  }

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export class OrmoAvatar extends HTMLElement implements OrmoAvatarElement {
  #controller: AbortController | undefined;
  #observer: MutationObserver | undefined;
  #delayTimer: ReturnType<typeof setTimeout> | undefined;
  #status: ImageLoadingStatus | undefined;
  #delayPassed = true;
  #initialized = false;

  get imageLoadingStatus(): ImageLoadingStatus {
    return this.#status ?? "error";
  }

  connectedCallback(): void {
    this.#controller?.abort();
    this.#controller = new AbortController();
    const { signal } = this.#controller;

    this.addEventListener("load", this.#handleImageEvent, {
      capture: true,
      signal,
    });
    this.addEventListener("error", this.#handleImageEvent, {
      capture: true,
      signal,
    });

    this.#observer?.disconnect();
    this.#observer = new MutationObserver(this.#handleMutations);
    this.#observer.observe(this, {
      attributes: true,
      attributeFilter: ["src", "srcset", "data-delay"],
      childList: true,
      subtree: true,
    });

    this.#sync({ announce: this.#initialized });
    this.#initialized = true;
  }

  disconnectedCallback(): void {
    this.#controller?.abort();
    this.#controller = undefined;
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#clearDelayTimer();
  }

  #getImage(): HTMLImageElement | undefined {
    return Array.from(
      this.querySelectorAll<HTMLImageElement>(imageSelector),
    ).find((image) => belongsToRoot(image, this));
  }

  #getFallbacks(): HTMLElement[] {
    return Array.from(
      this.querySelectorAll<HTMLElement>(fallbackSelector),
    ).filter((fallback) => belongsToRoot(fallback, this));
  }

  #handleImageEvent = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) {
      return;
    }

    if (!belongsToRoot(target, this) || !target.matches(imageSelector)) {
      return;
    }

    this.#sync();
  };

  #handleMutations = (mutations: MutationRecord[]): void => {
    const relevant = mutations.some((mutation) => {
      if (mutation.type === "childList") {
        return true;
      }

      if (!(mutation.target instanceof Element)) {
        return false;
      }

      return (
        mutation.target.matches(imageSelector) ||
        mutation.target.matches(fallbackSelector)
      );
    });

    if (relevant) {
      this.#sync();
    }
  };

  #sync(options: { announce?: boolean } = {}): void {
    const announce = options.announce ?? true;
    const image = this.#getImage();
    const nextStatus = image ? readImageStatus(image) : "error";

    if (nextStatus === "loading") {
      this.#ensureDelayTracking();
    } else {
      this.#clearDelayTimer();
      this.#delayPassed = true;
    }

    this.#setStatus(nextStatus, announce);
    this.#applyVisibility();
  }

  #ensureDelayTracking(): void {
    const fallbacks = this.#getFallbacks();
    const delay = Math.max(0, ...fallbacks.map(parseDelay));

    if (delay === 0) {
      this.#clearDelayTimer();
      this.#delayPassed = true;
      return;
    }

    if (this.#delayTimer !== undefined) {
      return;
    }

    this.#delayPassed = false;
    this.#delayTimer = setTimeout(() => {
      this.#delayTimer = undefined;
      this.#delayPassed = true;
      this.#applyVisibility();
    }, delay);
  }

  #clearDelayTimer(): void {
    if (this.#delayTimer !== undefined) {
      clearTimeout(this.#delayTimer);
      this.#delayTimer = undefined;
    }
  }

  #setStatus(status: ImageLoadingStatus, announce: boolean): void {
    if (this.#status === status && this.dataset.status === status) {
      return;
    }

    this.#status = status;
    this.dataset.status = status;

    if (announce) {
      this.dispatchEvent(
        new CustomEvent("ormo:avatar-loading-status-change", {
          bubbles: true,
          detail: { status },
        }),
      );
    }

    if (import.meta.env.DEV) {
      this.#validate();
    }
  }

  #applyVisibility(): void {
    const image = this.#getImage();
    const showImage = this.#status === "loaded";
    const showFallback = this.#status !== "loaded" && this.#delayPassed;

    if (image) {
      image.hidden = !showImage;
    }

    for (const fallback of this.#getFallbacks()) {
      fallback.hidden = !showFallback;
    }
  }

  #validate(): void {
    const image = this.#getImage();
    if (!image) {
      return;
    }

    if (!image.hasAttribute("alt")) {
      console.warn(
        '[ormo] Avatar.Image needs an alt attribute. Use a meaningful name, or alt="" when the avatar is decorative.',
        image,
      );
    }
  }
}

if (!customElements.get(tagName)) {
  customElements.define(tagName, OrmoAvatar);
}
