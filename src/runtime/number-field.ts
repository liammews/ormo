import type {
  NumberFieldStep,
  NumberFieldValueChangeDetail,
  NumberFieldValueChangeReason,
  OrmoNumberFieldElement,
} from "../components/number-field/types";

const tagName = "ormo-number-field";
const inputSelector = "input[type=number][data-ormo-number-field-input]";
const incrementSelector = "[data-ormo-number-field-increment]";
const decrementSelector = "[data-ormo-number-field-decrement]";

function owns(root: HTMLElement, element: Element): boolean {
  return element.closest(tagName) === root;
}

function optionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function valueFromDataset(value: string | undefined): number | null {
  return optionalNumber(value) ?? null;
}

function precision(value: number): number {
  const text = String(value).toLowerCase();
  if (text.includes("e-")) return Number(text.split("e-")[1]);
  return text.split(".")[1]?.length ?? 0;
}

function addPrecisely(value: number, amount: number): number {
  const places = Math.min(12, Math.max(precision(value), precision(amount)));
  return Number((value + amount).toFixed(places));
}

export function validateNumberField(root: HTMLElement): void {
  if (!import.meta.env.DEV) return;
  const inputs = Array.from(
    root.querySelectorAll<HTMLInputElement>(inputSelector),
  ).filter((input) => owns(root, input));
  if (inputs.length !== 1) {
    console.warn(
      "[Ormo Number Field] Add exactly one NumberField.Input inside NumberField.Root.",
      root,
    );
  }
  const input = inputs[0];
  if (input && !input.labels?.length && !input.getAttribute("aria-label")) {
    console.warn(
      "[Ormo Number Field] Give NumberField.Input an accessible name with Field.Label, a native label, or aria-label.",
      input,
    );
  }
}

export class OrmoNumberField
  extends HTMLElement
  implements OrmoNumberFieldElement
{
  static observedAttributes = [
    "data-value",
    "data-min",
    "data-max",
    "data-step",
    "data-disabled",
    "data-readonly",
    "data-required",
  ];

  #authoredButtonState = new WeakMap<
    HTMLButtonElement,
    { dataDisabled: string | null; disabled: boolean }
  >();
  #authoredInputState = new WeakMap<
    HTMLInputElement,
    {
      disabled: boolean;
      max: string | null;
      min: string | null;
      readOnly: boolean;
      required: boolean;
      step: string | null;
      value: string;
    }
  >();
  #controller: AbortController | undefined;
  #formController: AbortController | undefined;
  #initialised = false;
  #managedButtons = new Set<HTMLButtonElement>();
  #managedInputs = new Set<HTMLInputElement>();
  #observer: MutationObserver | undefined;
  #pendingReason: NumberFieldValueChangeReason = "input";
  #rootStateSnapshot: string | null | undefined;
  #syncing = false;

  connectedCallback(): void {
    this.#rootStateSnapshot ??= this.getAttribute("data-state");
    this.#controller?.abort();
    this.#controller = new AbortController();
    this.addEventListener("click", this.#onClick, {
      signal: this.#controller.signal,
    });
    this.addEventListener("keydown", this.#onKeyDown, {
      signal: this.#controller.signal,
    });
    this.addEventListener("input", this.#onInput, {
      signal: this.#controller.signal,
    });
    this.addEventListener("wheel", this.#onWheel, {
      passive: false,
      signal: this.#controller.signal,
    });
    this.#observer?.disconnect();
    this.#observer = new MutationObserver(() => {
      if (this.#syncing) return;
      this.#prepare();
      validateNumberField(this);
    });
    this.#observer.observe(this, {
      attributeFilter: ["disabled", "readonly", "required"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    this.#prepare();
    this.#initialised = true;
    validateNumberField(this);
  }

  disconnectedCallback(): void {
    this.#controller?.abort();
    this.#controller = undefined;
    this.#formController?.abort();
    this.#formController = undefined;
    this.#observer?.disconnect();
    this.#observer = undefined;
    for (const input of this.#managedInputs) this.#releaseInput(input);
    for (const button of this.#managedButtons) this.#releaseButton(button);
    this.#managedInputs.clear();
    this.#managedButtons.clear();
    if (this.#rootStateSnapshot === null) this.removeAttribute("data-state");
    else if (this.#rootStateSnapshot !== undefined)
      this.setAttribute("data-state", this.#rootStateSnapshot);
    this.#rootStateSnapshot = undefined;
  }

  attributeChangedCallback(): void {
    if (this.#initialised && this.isConnected) this.#prepare();
  }

  get value(): number | null {
    return valueFromDataset(this.dataset.value);
  }
  set value(value: number | null) {
    const previousValue = this.value;
    this.dataset.value = value === null ? "" : String(value);
    this.#prepare();
    if (previousValue !== this.value)
      this.#emit(previousValue, "programmatic", false);
  }

  get disabled(): boolean {
    return this.hasAttribute("data-disabled");
  }
  set disabled(value: boolean) {
    this.toggleAttribute("data-disabled", value);
  }

  get readOnly(): boolean {
    return this.hasAttribute("data-readonly");
  }
  set readOnly(value: boolean) {
    this.toggleAttribute("data-readonly", value);
  }

  get min(): number | undefined {
    return optionalNumber(this.dataset.min);
  }
  set min(value: number | undefined) {
    if (value === undefined) delete this.dataset.min;
    else this.dataset.min = String(value);
  }

  get max(): number | undefined {
    return optionalNumber(this.dataset.max);
  }
  set max(value: number | undefined) {
    if (value === undefined) delete this.dataset.max;
    else this.dataset.max = String(value);
  }

  get step(): NumberFieldStep {
    if (this.dataset.step === "any") return "any";
    const step = optionalNumber(this.dataset.step);
    return step !== undefined && step > 0 ? step : 1;
  }
  set step(value: NumberFieldStep) {
    this.dataset.step = String(value);
  }

  increment(multiplier = 1): void {
    this.#stepBy(1, multiplier, "increment");
  }

  decrement(multiplier = 1): void {
    this.#stepBy(-1, multiplier, "decrement");
  }

  #input(): HTMLInputElement | undefined {
    return this.#inputs()[0];
  }

  #inputs(): HTMLInputElement[] {
    return Array.from(
      this.querySelectorAll<HTMLInputElement>(inputSelector),
    ).filter((input) => owns(this, input));
  }

  #buttons(): HTMLButtonElement[] {
    return Array.from(
      this.querySelectorAll<HTMLButtonElement>(
        `${incrementSelector}, ${decrementSelector}`,
      ),
    ).filter((button) => owns(this, button));
  }

  #prepare(): void {
    const inputs = this.#inputs();
    const buttons = this.#buttons();
    for (const managed of this.#managedInputs) {
      if (!inputs.includes(managed)) {
        this.#releaseInput(managed);
        this.#managedInputs.delete(managed);
      }
    }
    for (const managed of this.#managedButtons) {
      if (!buttons.includes(managed)) {
        this.#releaseButton(managed);
        this.#managedButtons.delete(managed);
      }
    }
    const input = inputs[0];
    if (!input) return;
    if (!this.#authoredInputState.has(input)) {
      this.#authoredInputState.set(input, {
        disabled: input.hasAttribute("data-input-disabled") || input.disabled,
        max: input.getAttribute("max"),
        min: input.getAttribute("min"),
        readOnly: input.hasAttribute("data-input-readonly") || input.readOnly,
        required: input.required,
        step: input.getAttribute("step"),
        value: input.value,
      });
      this.#managedInputs.add(input);
    }
    const inputState = this.#authoredInputState.get(input)!;
    this.#syncing = true;
    const inputDisabled = this.disabled || inputState.disabled;
    const inputReadOnly = this.readOnly || inputState.readOnly;
    const inputRequired =
      this.hasAttribute("data-required") || inputState.required;
    if (input.disabled !== inputDisabled) input.disabled = inputDisabled;
    if (input.readOnly !== inputReadOnly) input.readOnly = inputReadOnly;
    if (input.required !== inputRequired) input.required = inputRequired;
    if (this.min === undefined) input.removeAttribute("min");
    else input.min = String(this.min);
    if (this.max === undefined) input.removeAttribute("max");
    else input.max = String(this.max);
    input.step = String(this.step);
    input.value = this.value === null ? "" : String(this.value);

    const cannotDecrease =
      this.value !== null && this.min !== undefined && this.value <= this.min;
    const cannotIncrease =
      this.value !== null && this.max !== undefined && this.value >= this.max;
    for (const button of buttons) {
      if (!this.#authoredButtonState.has(button)) {
        this.#authoredButtonState.set(button, {
          dataDisabled: button.getAttribute("data-disabled"),
          disabled: button.disabled,
        });
        this.#managedButtons.add(button);
      }
      const increment = button.matches(incrementSelector);
      const authoredButton = this.#authoredButtonState.get(button)!;
      const buttonDisabled =
        this.disabled ||
        this.readOnly ||
        authoredButton.disabled ||
        (increment ? cannotIncrease : cannotDecrease);
      if (button.disabled !== buttonDisabled) button.disabled = buttonDisabled;
      button.toggleAttribute("data-disabled", button.disabled);
    }
    this.dataset.state = this.value === null ? "empty" : "filled";
    this.#syncing = false;
    this.#listenForReset(input.form);
  }

  #releaseInput(input: HTMLInputElement): void {
    const state = this.#authoredInputState.get(input);
    if (!state) return;
    input.disabled = state.disabled;
    input.readOnly = state.readOnly;
    input.required = state.required;
    input.value = state.value;
    for (const [name, value] of [
      ["min", state.min],
      ["max", state.max],
      ["step", state.step],
    ] as const) {
      if (value === null) input.removeAttribute(name);
      else input.setAttribute(name, value);
    }
    this.#authoredInputState.delete(input);
  }

  #releaseButton(button: HTMLButtonElement): void {
    const state = this.#authoredButtonState.get(button);
    if (!state) return;
    button.disabled = state.disabled;
    if (state.dataDisabled === null) button.removeAttribute("data-disabled");
    else button.setAttribute("data-disabled", state.dataDisabled);
    this.#authoredButtonState.delete(button);
  }

  #listenForReset(form: HTMLFormElement | null): void {
    this.#formController?.abort();
    this.#formController = new AbortController();
    form?.addEventListener("reset", this.#onReset, {
      signal: this.#formController.signal,
    });
  }

  #stepAmount(
    event?: Pick<MouseEvent | KeyboardEvent, "altKey" | "shiftKey">,
  ): number {
    if (event?.altKey) return optionalNumber(this.dataset.smallStep) ?? 0.1;
    if (event?.shiftKey) return optionalNumber(this.dataset.largeStep) ?? 10;
    return this.step === "any" ? 1 : this.step;
  }

  #stepBy(
    direction: -1 | 1,
    multiplier: number,
    reason: NumberFieldValueChangeReason,
    event?: Pick<MouseEvent | KeyboardEvent, "altKey" | "shiftKey">,
  ): void {
    const input = this.#input();
    if (!input || this.disabled || this.readOnly) return;
    const previous = this.value;
    const amount = this.#stepAmount(event) * Math.max(0, multiplier);
    const base =
      previous ??
      (direction > 0
        ? this.min === undefined
          ? 0
          : this.min - amount
        : this.max === undefined
          ? 0
          : this.max + amount);
    let next = addPrecisely(base, direction * amount);
    if (this.min !== undefined) next = Math.max(this.min, next);
    if (this.max !== undefined) next = Math.min(this.max, next);
    if (next === previous) return;
    input.value = String(next);
    this.#pendingReason = reason;
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }

  #onClick = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    const increment = target?.closest<HTMLButtonElement>(incrementSelector);
    if (increment && owns(this, increment)) {
      this.#stepBy(1, 1, "increment", event);
      return;
    }
    const decrement = target?.closest<HTMLButtonElement>(decrementSelector);
    if (decrement && owns(this, decrement))
      this.#stepBy(-1, 1, "decrement", event);
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.target !== this.#input()) return;
    if (event.key === "Home" && this.min !== undefined) {
      event.preventDefault();
      this.#setInteractionValue(this.min, "keyboard");
    } else if (event.key === "End" && this.max !== undefined) {
      event.preventDefault();
      this.#setInteractionValue(this.max, "keyboard");
    } else if (
      (event.key === "ArrowUp" || event.key === "ArrowDown") &&
      (event.altKey || event.shiftKey)
    ) {
      event.preventDefault();
      this.#stepBy(event.key === "ArrowUp" ? 1 : -1, 1, "keyboard", event);
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      this.#pendingReason = "keyboard";
    }
  };

  #setInteractionValue(
    value: number,
    reason: NumberFieldValueChangeReason,
  ): void {
    const input = this.#input();
    if (!input || this.disabled || this.readOnly || value === this.value)
      return;
    input.value = String(value);
    this.#pendingReason = reason;
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }

  #onWheel = (event: WheelEvent): void => {
    if (
      !this.hasAttribute("data-allow-wheel-step") ||
      event.target !== this.#input() ||
      document.activeElement !== this.#input() ||
      event.deltaY === 0
    )
      return;
    event.preventDefault();
    this.#stepBy(event.deltaY < 0 ? 1 : -1, 1, "wheel", event);
  };

  #onInput = (event: Event): void => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input !== this.#input()) return;
    const previousValue = this.value;
    const nextValue =
      input.value === "" || !Number.isFinite(input.valueAsNumber)
        ? null
        : input.valueAsNumber;
    const reason = this.#pendingReason;
    this.#pendingReason = "input";
    const accepted = this.#emit(previousValue, reason, true, nextValue);
    if (this.hasAttribute("data-controlled") || !accepted) {
      this.#prepare();
      return;
    }
    this.dataset.value = nextValue === null ? "" : String(nextValue);
    this.#prepare();
  };

  #onReset = (): void => {
    queueMicrotask(() => {
      const previousValue = this.value;
      const initial = valueFromDataset(this.dataset.defaultValue);
      this.dataset.value = initial === null ? "" : String(initial);
      this.#prepare();
      if (previousValue !== initial) this.#emit(previousValue, "reset", false);
    });
  };

  #emit(
    previousValue: number | null,
    reason: NumberFieldValueChangeReason,
    cancelable: boolean,
    value = this.value,
  ): boolean {
    return this.dispatchEvent(
      new CustomEvent<NumberFieldValueChangeDetail>(
        "ormo:number-field-value-change",
        {
          bubbles: true,
          composed: true,
          cancelable,
          detail: { value, previousValue, reason },
        },
      ),
    );
  }
}

if (!customElements.get(tagName))
  customElements.define(tagName, OrmoNumberField);
