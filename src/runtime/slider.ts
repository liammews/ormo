import type {
  OrmoSliderElement,
  SliderOrientation,
  SliderValueChangeDetail,
} from "../components/slider/types";

const tagName = "ormo-slider";
const thumbSelector = "input[type=range][data-ormo-slider-thumb]";

function owns(root: HTMLElement, thumb: Element): boolean {
  return thumb.closest(tagName) === root;
}

function parseValues(value: string | undefined): number[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is number =>
            typeof entry === "number" && Number.isFinite(entry),
        )
      : [];
  } catch {
    return [];
  }
}

function finiteNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function validateSlider(root: HTMLElement): void {
  if (!import.meta.env.DEV) return;
  const thumbs = Array.from(
    root.querySelectorAll<HTMLInputElement>(thumbSelector),
  ).filter((thumb) => owns(root, thumb));
  if (thumbs.length === 0) {
    console.warn("[Ormo Slider] Add at least one Thumb.", root);
    return;
  }
  for (const thumb of thumbs) {
    const labelledBy = thumb.getAttribute("aria-labelledby")?.split(/\s+/);
    const named = Boolean(
      thumb.getAttribute("aria-label")?.trim() ||
      labelledBy?.some((id) =>
        root.ownerDocument.getElementById(id)?.textContent?.trim(),
      ) ||
      (thumb.id &&
        root.ownerDocument
          .querySelector<HTMLLabelElement>(
            `label[for="${CSS.escape(thumb.id)}"]`,
          )
          ?.textContent?.trim()),
    );
    if (!named)
      console.warn("[Ormo Slider] Give every Thumb an accessible name.", thumb);
  }
}

export class OrmoSlider extends HTMLElement implements OrmoSliderElement {
  static observedAttributes = [
    "data-value",
    "data-disabled",
    "data-min",
    "data-max",
    "data-step",
    "data-orientation",
  ];

  #controller: AbortController | undefined;
  #observer: MutationObserver | undefined;
  #initialised = false;
  #syncing = false;
  #authoredDisabled = new WeakMap<HTMLInputElement, boolean>();

  connectedCallback(): void {
    this.#controller?.abort();
    this.#controller = new AbortController();
    this.addEventListener("input", this.#onInput, {
      signal: this.#controller.signal,
    });
    this.#observer?.disconnect();
    this.#observer = new MutationObserver(() => {
      if (this.#syncing) return;
      this.#prepare();
      validateSlider(this);
    });
    this.#observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled", "data-thumb-disabled"],
    });
    this.#prepare();
    for (const form of new Set(this.#thumbs().map((thumb) => thumb.form))) {
      form?.addEventListener("reset", this.#onReset, {
        signal: this.#controller.signal,
      });
    }
    this.#initialised = true;
    validateSlider(this);
  }

  disconnectedCallback(): void {
    this.#controller?.abort();
    this.#controller = undefined;
    this.#observer?.disconnect();
    this.#observer = undefined;
    for (const thumb of this.#thumbs()) {
      const disabled = this.#authoredDisabled.get(thumb);
      if (disabled !== undefined) thumb.disabled = disabled;
    }
  }

  attributeChangedCallback(): void {
    if (this.#initialised && this.isConnected) this.#prepare();
  }

  get value(): number[] {
    return parseValues(this.dataset.value);
  }
  set value(value: number[]) {
    const previousValue = this.value;
    this.dataset.value = JSON.stringify(this.#normaliseValues(value));
    this.#prepare();
    if (JSON.stringify(previousValue) !== JSON.stringify(this.value)) {
      this.#emit(previousValue, -1, "programmatic", false);
    }
  }

  get disabled(): boolean {
    return this.hasAttribute("data-disabled");
  }
  set disabled(value: boolean) {
    this.toggleAttribute("data-disabled", value);
  }

  get min(): number {
    return finiteNumber(this.dataset.min, 0);
  }
  set min(value: number) {
    this.dataset.min = String(value);
  }

  get max(): number {
    return finiteNumber(this.dataset.max, 100);
  }
  set max(value: number) {
    this.dataset.max = String(value);
  }

  get step(): number {
    return finiteNumber(this.dataset.step, 1);
  }
  set step(value: number) {
    this.dataset.step = String(value);
  }

  get orientation(): SliderOrientation {
    return this.dataset.orientation === "vertical" ? "vertical" : "horizontal";
  }
  set orientation(value: SliderOrientation) {
    this.dataset.orientation = value === "vertical" ? "vertical" : "horizontal";
  }

  #thumbs(): HTMLInputElement[] {
    return Array.from(
      this.querySelectorAll<HTMLInputElement>(thumbSelector),
    ).filter((thumb) => owns(this, thumb));
  }

  #normaliseValues(values: readonly number[]): number[] {
    const min = Math.min(this.min, this.max);
    const max = Math.max(this.min, this.max);
    return values
      .filter(Number.isFinite)
      .map((value) => Math.min(max, Math.max(min, value)))
      .sort((a, b) => a - b);
  }

  #prepare(): void {
    const thumbs = this.#thumbs();
    const values = this.#normaliseValues(this.value);
    const min = Math.min(this.min, this.max);
    const max = Math.max(this.min, this.max);
    const step = this.step > 0 ? this.step : 1;
    this.#syncing = true;
    thumbs.forEach((thumb, index) => {
      if (!this.#authoredDisabled.has(thumb)) {
        this.#authoredDisabled.set(
          thumb,
          thumb.hasAttribute("data-thumb-disabled") || thumb.disabled,
        );
      }
      thumb.min = String(min);
      thumb.max = String(max);
      thumb.step = String(step);
      thumb.value = String(values[index] ?? min);
      thumb.disabled =
        this.disabled || (this.#authoredDisabled.get(thumb) ?? false);
      thumb.setAttribute("aria-orientation", this.orientation);
      thumb.dataset.thumbIndex = String(index);
    });
    this.#syncing = false;
    this.#updateGeometry(values);
  }

  #updateGeometry(values: readonly number[]): void {
    const span = this.max - this.min;
    const first = values.length > 1 ? (values[0] ?? this.min) : this.min;
    const last = values.at(-1) ?? first;
    const start = span > 0 ? ((first - this.min) / span) * 100 : 0;
    const end = span > 0 ? ((last - this.min) / span) * 100 : 0;
    this.style.setProperty("--ormo-slider-start", `${start}%`);
    this.style.setProperty("--ormo-slider-end", `${end}%`);
  }

  #onInput = (event: Event): void => {
    const thumb =
      event.target instanceof HTMLInputElement &&
      event.target.matches(thumbSelector)
        ? event.target
        : undefined;
    if (!thumb || !owns(this, thumb) || this.disabled) return;
    const thumbs = this.#thumbs();
    const index = thumbs.indexOf(thumb);
    if (index < 0) return;
    const previousValue = this.value;
    const lowerBound = previousValue[index - 1] ?? this.min;
    const upperBound = previousValue[index + 1] ?? this.max;
    thumb.value = String(
      Math.min(upperBound, Math.max(lowerBound, thumb.valueAsNumber)),
    );
    const nextValue = thumbs.map((item) => item.valueAsNumber);
    const controlled = this.hasAttribute("data-controlled");
    const accepted = this.#emit(previousValue, index, "input", true, nextValue);
    if (controlled || !accepted) {
      this.#prepare();
      return;
    }
    this.dataset.value = JSON.stringify(nextValue);
    this.#prepare();
  };

  #onReset = (): void => {
    queueMicrotask(() => {
      const previousValue = this.value;
      const initial = parseValues(this.dataset.defaultValue);
      this.dataset.value = JSON.stringify(initial);
      this.#prepare();
      if (JSON.stringify(previousValue) !== JSON.stringify(initial)) {
        this.#emit(previousValue, -1, "reset", false);
      }
    });
  };

  #emit(
    previousValue: number[],
    thumbIndex: number,
    reason: SliderValueChangeDetail["reason"],
    cancelable: boolean,
    value = this.value,
  ): boolean {
    return this.dispatchEvent(
      new CustomEvent<SliderValueChangeDetail>("ormo:value-change", {
        bubbles: true,
        cancelable,
        detail: { value: [...value], previousValue, thumbIndex, reason },
      }),
    );
  }
}

if (!customElements.get(tagName)) customElements.define(tagName, OrmoSlider);
