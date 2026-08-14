import type {
  OrmoToggleGroupElement,
  ToggleGroupOrientation,
  ToggleGroupValueChangeDetail,
} from "../components/toggle-group/types";
import {
  getCollectionItems,
  moveCollectionItem,
  setRovingTabStop,
} from "./collection-navigation";

const tagName = "ormo-toggle-group";
const itemSelector = "[data-ormo-toggle-group-item]";

function owns(root: HTMLElement, item: Element): boolean {
  return item.closest(tagName) === root;
}

function parseValues(root: HTMLElement): string[] {
  try {
    const value: unknown = JSON.parse(root.dataset.value ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function validateToggleGroup(root: HTMLElement): void {
  if (!import.meta.env.DEV) return;
  const labelledBy = root.getAttribute("aria-labelledby")?.split(/\s+/);
  const named = Boolean(
    root.getAttribute("aria-label")?.trim() ||
    labelledBy?.some((id) =>
      root.ownerDocument.getElementById(id)?.textContent?.trim(),
    ),
  );
  if (!named)
    console.warn("[Ormo ToggleGroup] Add aria-label or aria-labelledby.", root);
  if (root.dataset.type !== "single" && root.dataset.type !== "multiple") {
    console.warn(
      '[Ormo ToggleGroup] Set type to "single" or "multiple".',
      root,
    );
  }
  const values = new Set<string>();
  for (const item of root.querySelectorAll<HTMLButtonElement>(itemSelector)) {
    if (!owns(root, item)) continue;
    const value = item.dataset.value ?? "";
    if (!value)
      console.warn(
        "[Ormo ToggleGroup] Every Item needs a non-empty value.",
        item,
      );
    else if (values.has(value))
      console.warn(
        `[Ormo ToggleGroup] Item value "${value}" is duplicated.`,
        item,
      );
    values.add(value);
  }
}

export class OrmoToggleGroup
  extends HTMLElement
  implements OrmoToggleGroupElement
{
  static formAssociated = true;
  static observedAttributes = [
    "data-value",
    "data-disabled",
    "data-required",
    "data-orientation",
    "data-loop-focus",
    "name",
  ];

  #controller: AbortController | undefined;
  #observer: MutationObserver | undefined;
  #initialised = false;
  #authoredDisabled = new WeakMap<HTMLButtonElement, boolean>();
  #lastDisabled = new WeakMap<HTMLButtonElement, boolean>();
  #authoredTabIndex = new WeakMap<HTMLButtonElement, string | null>();
  #authoredAttributes = new Map<Element, Map<string, string | null>>();
  #internals: ElementInternals | undefined;

  constructor() {
    super();
    this.#internals = this.attachInternals?.();
  }

  connectedCallback(): void {
    this.#controller?.abort();
    this.#controller = new AbortController();
    this.addEventListener("click", this.#onClick, {
      signal: this.#controller.signal,
    });
    this.addEventListener("keydown", this.#onKeydown, {
      signal: this.#controller.signal,
    });
    this.#observer?.disconnect();
    this.#observer = new MutationObserver((records) => {
      this.#captureMutations(records);
      this.#normaliseAfterMutation();
      this.#prepare();
      validateToggleGroup(this);
    });
    this.#observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "disabled",
        "data-item-disabled",
        "data-value",
        "value",
      ],
    });
    this.#prepare();
    this.#initialised = true;
    validateToggleGroup(this);
  }

  disconnectedCallback(): void {
    this.#controller?.abort();
    this.#controller = undefined;
    this.#observer?.disconnect();
    this.#observer = undefined;
    for (const item of this.#items()) {
      const disabled = this.#authoredDisabled.get(item);
      if (disabled !== undefined) item.disabled = disabled;
      const tabIndex = this.#authoredTabIndex.get(item);
      if (tabIndex === null) item.removeAttribute("tabindex");
      else if (tabIndex !== undefined) item.setAttribute("tabindex", tabIndex);
    }
    for (const [element, values] of this.#authoredAttributes) {
      for (const [name, value] of values) {
        if (value === null) element.removeAttribute(name);
        else element.setAttribute(name, value);
      }
    }
    this.#authoredAttributes.clear();
  }

  attributeChangedCallback(): void {
    if (this.#initialised && this.isConnected) this.#prepare();
  }

  get value(): string | string[] {
    const values = parseValues(this);
    return this.dataset.type === "multiple" ? values : (values[0] ?? "");
  }
  set value(value: string | string[]) {
    const previous = this.value;
    const values = Array.isArray(value) ? value : value ? [value] : [];
    this.dataset.value = JSON.stringify(values);
    if (JSON.stringify(previous) !== JSON.stringify(this.value)) {
      this.#emitValueChange(previous, "programmatic", false);
    }
  }
  get disabled(): boolean {
    return this.hasAttribute("data-disabled");
  }
  set disabled(value: boolean) {
    this.toggleAttribute("data-disabled", value);
  }
  get required(): boolean {
    return this.hasAttribute("data-required");
  }
  set required(value: boolean) {
    this.toggleAttribute("data-required", value);
  }
  get orientation(): ToggleGroupOrientation {
    return this.dataset.orientation === "vertical" ? "vertical" : "horizontal";
  }
  set orientation(value: ToggleGroupOrientation) {
    this.dataset.orientation = value === "vertical" ? "vertical" : "horizontal";
  }
  get loopFocus(): boolean {
    return this.dataset.loopFocus !== "false";
  }
  set loopFocus(value: boolean) {
    if (value) delete this.dataset.loopFocus;
    else this.dataset.loopFocus = "false";
  }
  get name(): string {
    return this.getAttribute("name") ?? "";
  }
  set name(value: string) {
    if (value) this.setAttribute("name", value);
    else this.removeAttribute("name");
  }
  get form(): HTMLFormElement | null {
    return this.#internals?.form ?? null;
  }
  get valid(): boolean {
    return this.#internals?.validity.valid ?? this.#isValid();
  }
  checkValidity(): boolean {
    return this.#internals?.checkValidity() ?? this.#isValid();
  }
  reportValidity(): boolean {
    return this.#internals?.reportValidity() ?? this.#isValid();
  }

  formResetCallback(): void {
    const initial = this.#parseAttribute("data-default-value");
    this.dataset.value = JSON.stringify(initial);
  }

  #items(): HTMLButtonElement[] {
    return getCollectionItems<HTMLButtonElement>(this, itemSelector, (item) =>
      owns(this, item),
    );
  }

  #syncAuthored(item: HTMLButtonElement): void {
    this.#snapshot(item, [
      "aria-pressed",
      "data-disabled",
      "data-orientation",
      "data-state",
    ]);
    if (!this.#authoredTabIndex.has(item)) {
      this.#authoredTabIndex.set(item, item.getAttribute("tabindex"));
    }
    const last = this.#lastDisabled.get(item);
    if (last === undefined || item.disabled !== last) {
      this.#authoredDisabled.set(item, item.disabled);
    }
  }

  #snapshot(element: Element, names: string[]): void {
    let values = this.#authoredAttributes.get(element);
    if (!values) {
      values = new Map();
      this.#authoredAttributes.set(element, values);
    }
    for (const name of names) {
      if (!values.has(name)) values.set(name, element.getAttribute(name));
    }
  }

  #captureMutations(records: MutationRecord[]): void {
    for (const record of records) {
      const item = record.target;
      if (!(item instanceof HTMLButtonElement) || !owns(this, item)) continue;
      if (record.attributeName === "disabled") {
        const last = this.#lastDisabled.get(item);
        if (last === undefined || item.disabled !== last) {
          this.#authoredDisabled.set(item, item.disabled);
          item.toggleAttribute("data-item-disabled", item.disabled);
        }
      }
      if (record.attributeName === "value") item.dataset.value = item.value;
    }
  }

  #parseAttribute(name: string): string[] {
    try {
      const value: unknown = JSON.parse(this.getAttribute(name) ?? "[]");
      return Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === "string")
        : [];
    } catch {
      return [];
    }
  }

  #normalisedValues(): string[] {
    const current = parseValues(this);
    const items = this.#items();
    const available = new Set(items.map((item) => item.dataset.value ?? ""));
    let next = current.filter(
      (value, index) =>
        available.has(value) && current.indexOf(value) === index,
    );
    if (this.dataset.type !== "multiple") next = next.slice(0, 1);
    if (
      this.dataset.type !== "multiple" &&
      this.required &&
      next.length === 0
    ) {
      const first = items.find((item) => !this.#isDisabled(item));
      if (first?.dataset.value) next = [first.dataset.value];
    }
    return next;
  }

  #normaliseAfterMutation(): void {
    const previous = this.value;
    const next = this.#normalisedValues();
    if (JSON.stringify(parseValues(this)) === JSON.stringify(next)) return;
    if (!this.hasAttribute("data-controlled")) {
      this.dataset.value = JSON.stringify(next);
    }
    this.#emitValueChange(
      previous,
      "member-removed",
      true,
      this.dataset.type === "multiple" ? next : (next[0] ?? ""),
    );
  }

  #isDisabled(item: HTMLButtonElement): boolean {
    return (
      this.disabled ||
      item.hasAttribute("data-item-disabled") ||
      this.#authoredDisabled.get(item) === true
    );
  }

  #isValid(): boolean {
    return !(
      this.required &&
      this.dataset.type !== "multiple" &&
      parseValues(this).length === 0
    );
  }

  #syncForm(): void {
    if (!this.#internals) return;
    const values = parseValues(this);
    if (!this.name || values.length === 0 || this.disabled) {
      this.#internals.setFormValue(null);
    } else if (this.dataset.type === "multiple") {
      const data = new FormData();
      for (const value of values) data.append(this.name, value);
      this.#internals.setFormValue(data);
    } else {
      this.#internals.setFormValue(values[0] ?? null);
    }
    this.#internals.setValidity(
      this.#isValid() ? {} : { valueMissing: true },
      this.#isValid() ? "" : "Select an option.",
      this.#items().find((item) => !item.disabled),
    );
    this.toggleAttribute("data-invalid", !this.#isValid());
  }

  #prepare = (): void => {
    const selected = new Set(parseValues(this));
    const items = this.#items();
    for (const item of items) this.#syncAuthored(item);
    const enabled = items.filter((item) => {
      const disabled = this.#isDisabled(item);
      if (item.disabled !== disabled) item.disabled = disabled;
      this.#lastDisabled.set(item, disabled);
      item.toggleAttribute("data-disabled", disabled);
      item.dataset.orientation = this.orientation;
      const pressed = selected.has(item.dataset.value ?? "");
      item.setAttribute("aria-pressed", String(pressed));
      item.dataset.state = pressed ? "on" : "off";
      return !disabled;
    });
    const active = enabled.find(
      (item) => item.getAttribute("aria-pressed") === "true",
    );
    const current = enabled.find((item) => item.tabIndex === 0);
    setRovingTabStop(items, active ?? current ?? enabled[0]);
    this.#syncForm();
  };

  #emitValueChange(
    previousValue: string | string[],
    reason: ToggleGroupValueChangeDetail["reason"],
    cancelable: boolean,
    value: string | string[] = this.value,
  ): boolean {
    return this.dispatchEvent(
      new CustomEvent("ormo:value-change", {
        bubbles: true,
        composed: true,
        cancelable,
        detail: { value, previousValue, reason },
      }),
    );
  }

  #request(item: HTMLButtonElement): void {
    const itemValue = item.dataset.value;
    if (itemValue === undefined) return;
    const multiple = this.dataset.type === "multiple";
    const previous = this.value;
    const values = new Set(parseValues(this));
    if (values.has(itemValue)) {
      if (!(!multiple && this.required)) values.delete(itemValue);
    } else {
      if (!multiple) values.clear();
      values.add(itemValue);
    }
    const next: string | string[] = multiple
      ? Array.from(values)
      : (Array.from(values)[0] ?? "");
    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    const detail: ToggleGroupValueChangeDetail = {
      value: next,
      previousValue: previous,
      reason: "item",
    };
    const accepted = this.dispatchEvent(
      new CustomEvent("ormo:value-change", {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail,
      }),
    );
    if (accepted && !this.hasAttribute("data-controlled")) {
      this.dataset.value = JSON.stringify(Array.from(values));
    }
  }

  #onClick = (event: MouseEvent): void => {
    const item =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>(itemSelector)
        : null;
    if (!item || !owns(this, item) || item.disabled) return;
    this.#request(item);
  };

  #move(item: HTMLButtonElement, delta: -1 | 1): void {
    const enabled = this.#items().filter((candidate) => !candidate.disabled);
    const next = moveCollectionItem({
      items: enabled,
      current: item,
      delta,
      loop: this.loopFocus,
    });
    if (next) {
      setRovingTabStop(this.#items(), next);
      next.focus();
    }
  }

  #onKeydown = (event: KeyboardEvent): void => {
    const item =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>(itemSelector)
        : null;
    if (!item || !owns(this, item) || item.disabled) return;
    const rtl = getComputedStyle(this).direction === "rtl";
    const previous =
      this.orientation === "horizontal"
        ? rtl
          ? "ArrowRight"
          : "ArrowLeft"
        : "ArrowUp";
    const next =
      this.orientation === "horizontal"
        ? rtl
          ? "ArrowLeft"
          : "ArrowRight"
        : "ArrowDown";
    if (event.key === previous || event.key === next) {
      event.preventDefault();
      this.#move(item, event.key === previous ? -1 : 1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const enabled = this.#items().filter((candidate) => !candidate.disabled);
      const target = event.key === "Home" ? enabled[0] : enabled.at(-1);
      if (target) {
        setRovingTabStop(this.#items(), target);
        target.focus();
      }
    }
  };
}

if (!customElements.get(tagName))
  customElements.define(tagName, OrmoToggleGroup);
