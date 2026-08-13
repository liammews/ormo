export const startingStyleAttribute = "data-starting-style";
export const endingStyleAttribute = "data-ending-style";

export class PopupTransition {
  #frame: number | undefined;
  #timeout: ReturnType<typeof setTimeout> | undefined;
  #version = 0;

  clear(): void {
    this.#version += 1;

    if (this.#frame !== undefined) {
      cancelAnimationFrame(this.#frame);
      this.#frame = undefined;
    }

    if (this.#timeout !== undefined) {
      clearTimeout(this.#timeout);
      this.#timeout = undefined;
    }
  }

  beginOpening(element: HTMLElement, isOpen: () => boolean): void {
    this.clear();
    const version = this.#version;
    element.removeAttribute(endingStyleAttribute);
    element.setAttribute(startingStyleAttribute, "");

    this.#frame = requestAnimationFrame(() => {
      this.#frame = undefined;
      if (this.#version === version && isOpen()) {
        element.removeAttribute(startingStyleAttribute);
      }
    });
  }

  beginClosing(element: HTMLElement, isOpen: () => boolean): void {
    this.clear();
    const version = this.#version;
    element.removeAttribute(startingStyleAttribute);
    element.setAttribute(endingStyleAttribute, "");

    this.#frame = requestAnimationFrame(() => {
      this.#frame = undefined;
      if (this.#version !== version || isOpen()) return;

      const animations =
        typeof element.getAnimations === "function"
          ? element
              .getAnimations()
              .filter((animation) => animation.playState !== "paused")
          : [];

      if (animations.length === 0) {
        element.removeAttribute(endingStyleAttribute);
        return;
      }

      const endTimes = animations
        .map((animation) =>
          Number(animation.effect?.getComputedTiming().endTime),
        )
        .filter(Number.isFinite);
      const maximumEndTime = Math.max(0, ...endTimes);
      this.#timeout = setTimeout(() => {
        if (this.#version === version) {
          element.removeAttribute(endingStyleAttribute);
        }
      }, maximumEndTime + 50);

      void Promise.allSettled(
        animations.map((animation) => animation.finished),
      ).then(() => {
        if (this.#version !== version) return;

        if (this.#timeout !== undefined) {
          clearTimeout(this.#timeout);
          this.#timeout = undefined;
        }
        element.removeAttribute(endingStyleAttribute);
      });
    });
  }
}
