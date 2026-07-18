import type {
  AccordionType,
  AccordionValue,
} from "../components/accordion/types";
import { cancelCollapsibleState, setCollapsibleState } from "./collapsible";

const tagName = "goodui-accordion";
const itemSelector = "[data-goodui-accordion-item]";
const triggerSelector = "[data-goodui-accordion-trigger]";
const contentSelector = "[data-goodui-accordion-content]";
const contentHeightProperty = "--goodui-accordion-content-height";

let generatedId = 0;

interface AccordionPart {
  item: HTMLElement;
  trigger: HTMLButtonElement;
  content: HTMLElement;
  value: string;
  disabled: boolean;
}

function belongsToRoot(element: Element, root: HTMLElement): boolean {
  return element.closest(tagName) === root;
}

function findOwnedElement<T extends Element>(
  item: HTMLElement,
  selector: string,
): T | undefined {
  return Array.from(item.querySelectorAll<T>(selector)).find(
    (element) => element.closest(itemSelector) === item,
  );
}

function valuesEqual(left: AccordionValue, right: AccordionValue): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => value === right[index])
    );
  }

  return left === right;
}

export class GoodUIAccordion extends HTMLElement {
  #controller: AbortController | undefined;
  #initialized = false;

  connectedCallback(): void {
    const initialValue = this.#initialized
      ? this.value
      : this.#readDefaultValue();

    this.#prepareParts();
    this.#applyValue(initialValue, false);
    this.#initialized = true;
    this.#controller?.abort();
    this.#controller = new AbortController();

    this.addEventListener("click", this.#handleClick, {
      signal: this.#controller.signal,
    });
    this.addEventListener("keydown", this.#handleKeydown, {
      signal: this.#controller.signal,
    });
  }

  disconnectedCallback(): void {
    this.#controller?.abort();
    this.#controller = undefined;
    this.#getParts().forEach(({ content }) => {
      cancelCollapsibleState(content);
    });
  }

  get value(): AccordionValue {
    const openValues = this.#getParts()
      .filter(({ item }) => item.dataset.state === "open")
      .map(({ value }) => value);

    return this.#type === "multiple" ? openValues : (openValues[0] ?? null);
  }

  set value(value: AccordionValue) {
    this.#applyValue(this.#normalizeValue(value));
  }

  get #type(): AccordionType {
    return this.dataset.type === "multiple" ? "multiple" : "single";
  }

  get #collapsible(): boolean {
    return this.hasAttribute("data-collapsible");
  }

  #getParts(): AccordionPart[] {
    return Array.from(this.querySelectorAll<HTMLElement>(itemSelector))
      .filter((item) => belongsToRoot(item, this))
      .flatMap((item) => {
        const trigger = findOwnedElement<HTMLButtonElement>(
          item,
          triggerSelector,
        );
        const content = findOwnedElement<HTMLElement>(item, contentSelector);
        const value = item.dataset.value;

        if (!trigger || !content || value === undefined) {
          return [];
        }

        return [
          {
            item,
            trigger,
            content,
            value,
            disabled: item.hasAttribute("data-disabled") || trigger.disabled,
          },
        ];
      });
  }

  #prepareParts(): void {
    if (!this.id) {
      generatedId += 1;
      this.id = `goodui-accordion-${generatedId}`;
    }

    this.#getParts().forEach(({ item, trigger, content, disabled }, index) => {
      trigger.id ||= `${this.id}-trigger-${index + 1}`;
      content.id ||= `${this.id}-content-${index + 1}`;

      trigger.disabled = disabled;
      trigger.setAttribute("aria-controls", content.id);
      content.setAttribute("aria-labelledby", trigger.id);
      content.setAttribute("role", "region");

      if (disabled) {
        item.setAttribute("data-disabled", "");
        trigger.setAttribute("data-disabled", "");
      }
    });
  }

  #readDefaultValue(): AccordionValue {
    const fallback = this.#type === "multiple" ? [] : null;
    const serializedValue = this.dataset.defaultValue;

    if (serializedValue === undefined) {
      return fallback;
    }

    try {
      return this.#normalizeValue(JSON.parse(serializedValue) as unknown);
    } catch {
      return fallback;
    }
  }

  #normalizeValue(value: unknown): AccordionValue {
    if (this.#type === "multiple") {
      const values = Array.isArray(value) ? value : [value];
      return Array.from(
        new Set(
          values.filter((item): item is string => typeof item === "string"),
        ),
      );
    }

    if (Array.isArray(value)) {
      return (
        value.find((item): item is string => typeof item === "string") ?? null
      );
    }

    return typeof value === "string" ? value : null;
  }

  #applyValue(value: AccordionValue, animate = this.#initialized): void {
    const normalizedValue = this.#normalizeValue(value);
    const selectedValues = new Set(
      Array.isArray(normalizedValue)
        ? normalizedValue
        : normalizedValue === null
          ? []
          : [normalizedValue],
    );

    this.#getParts().forEach(({ item, trigger, content, value: itemValue }) => {
      const open = selectedValues.has(itemValue);
      const state = open ? "open" : "closed";

      const stateChanged = content.dataset.state !== state;

      item.dataset.state = state;
      trigger.dataset.state = state;
      trigger.setAttribute("aria-expanded", String(open));

      if (!animate || stateChanged) {
        setCollapsibleState(content, open, {
          animate,
          fallbackFocus: trigger,
          heightProperty: contentHeightProperty,
        });
      }
    });
  }

  #requestValue(value: AccordionValue): void {
    const normalizedValue = this.#normalizeValue(value);

    if (valuesEqual(this.value, normalizedValue)) {
      return;
    }

    const event = new CustomEvent("goodui:value-change", {
      bubbles: true,
      cancelable: true,
      composed: true,
      detail: { value: normalizedValue },
    });

    if (this.dispatchEvent(event)) {
      this.#applyValue(normalizedValue);
    }
  }

  #handleClick = (event: MouseEvent): void => {
    const target = event.target;
    const trigger =
      target instanceof Element
        ? target.closest<HTMLButtonElement>(triggerSelector)
        : null;

    if (!trigger || !belongsToRoot(trigger, this) || trigger.disabled) {
      return;
    }

    const item = trigger.closest<HTMLElement>(itemSelector);
    const itemValue = item?.dataset.value;

    if (!item || itemValue === undefined) {
      return;
    }

    const open = item.dataset.state === "open";

    if (this.#type === "multiple") {
      const currentValue = this.value as string[];
      this.#requestValue(
        open
          ? currentValue.filter((value) => value !== itemValue)
          : [...currentValue, itemValue],
      );
      return;
    }

    if (open && !this.#collapsible) {
      return;
    }

    this.#requestValue(open ? null : itemValue);
  };

  #handleKeydown = (event: KeyboardEvent): void => {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const target = event.target;
    const trigger =
      target instanceof Element
        ? target.closest<HTMLButtonElement>(triggerSelector)
        : null;

    if (!trigger || !belongsToRoot(trigger, this)) {
      return;
    }

    const triggers = this.#getParts()
      .filter((part) => !part.disabled)
      .map((part) => part.trigger);
    const currentIndex = triggers.indexOf(trigger);

    if (currentIndex === -1) {
      return;
    }

    const horizontal = this.dataset.orientation === "horizontal";
    const rtl = this.dir === "rtl";
    let nextIndex: number | undefined;

    switch (event.key) {
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = triggers.length - 1;
        break;
      case "ArrowDown":
        if (!horizontal) nextIndex = currentIndex + 1;
        break;
      case "ArrowUp":
        if (!horizontal) nextIndex = currentIndex - 1;
        break;
      case "ArrowRight":
        if (horizontal) nextIndex = currentIndex + (rtl ? -1 : 1);
        break;
      case "ArrowLeft":
        if (horizontal) nextIndex = currentIndex + (rtl ? 1 : -1);
        break;
    }

    if (nextIndex === undefined || triggers.length === 0) {
      return;
    }

    event.preventDefault();
    triggers[(nextIndex + triggers.length) % triggers.length]?.focus();
  };
}

if (!customElements.get(tagName)) {
  customElements.define(tagName, GoodUIAccordion);
}
