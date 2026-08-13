import type {
  AccordionType,
  AccordionValue,
} from "../components/accordion/types";
import {
  cancelAccordionContentState,
  setAccordionContentState,
  setAccordionContentWidth,
} from "./accordion-content-state";

const tagName = "ormo-accordion";
const itemSelector = "[data-ormo-accordion-item]";
const headerSelector = "[data-ormo-accordion-header]";
const triggerSelector = "[data-ormo-accordion-trigger]";
const contentSelector = "[data-ormo-accordion-content]";
const contentHeightProperty = "--ormo-accordion-content-height";
const contentWidthProperty = "--ormo-accordion-content-width";

let generatedId = 0;

interface AccordionPart {
  item: HTMLElement;
  header: HTMLElement | undefined;
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

export class OrmoAccordion extends HTMLElement {
  static observedAttributes = [
    "data-disabled",
    "data-collapsible",
    "data-hidden-until-found",
    "data-type",
  ];

  #controller: AbortController | undefined;
  #authoredTriggerDisabled = new WeakMap<HTMLButtonElement, boolean>();
  #lastAppliedTriggerDisabled = new WeakMap<HTMLButtonElement, boolean>();
  #initialized = false;
  #observer: MutationObserver | undefined;
  #resizeObserver: ResizeObserver | undefined;

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
    this.addEventListener("beforematch", this.#handleBeforeMatch, {
      signal: this.#controller.signal,
    });

    this.#observer?.disconnect();
    this.#observer = new MutationObserver(() => {
      const value = this.value;
      this.#prepareParts();
      this.#applyValue(value, false);
      this.#observeContentSizes();
    });
    this.#observer.observe(this, { childList: true, subtree: true });
    this.#observeContentSizes();
  }

  disconnectedCallback(): void {
    this.#controller?.abort();
    this.#controller = undefined;
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
    this.#getParts().forEach(({ content }) => {
      cancelAccordionContentState(content);
    });
  }

  attributeChangedCallback(): void {
    if (!this.#initialized || !this.isConnected) return;

    const value = this.value;
    this.#prepareParts();
    this.#applyValue(value, false);
  }

  get type(): AccordionType {
    return this.#type;
  }

  set type(type: AccordionType) {
    this.dataset.type = type === "multiple" ? "multiple" : "single";
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

  get collapsible(): boolean {
    return this.#collapsible;
  }

  set collapsible(collapsible: boolean) {
    if (collapsible) {
      this.removeAttribute("data-collapsible");
    } else {
      this.setAttribute("data-collapsible", "false");
    }
  }

  get disabled(): boolean {
    return this.hasAttribute("data-disabled");
  }

  set disabled(disabled: boolean) {
    this.toggleAttribute("data-disabled", disabled);
  }

  get hiddenUntilFound(): boolean {
    return this.getAttribute("data-hidden-until-found") !== "false";
  }

  set hiddenUntilFound(hiddenUntilFound: boolean) {
    if (hiddenUntilFound) {
      this.removeAttribute("data-hidden-until-found");
    } else {
      this.setAttribute("data-hidden-until-found", "false");
    }
  }

  get #type(): AccordionType {
    return this.dataset.type === "multiple" ? "multiple" : "single";
  }

  get #collapsible(): boolean {
    return this.getAttribute("data-collapsible") !== "false";
  }

  #getParts(): AccordionPart[] {
    return Array.from(this.querySelectorAll<HTMLElement>(itemSelector))
      .filter((item) => belongsToRoot(item, this))
      .flatMap((item) => {
        const header = findOwnedElement<HTMLElement>(item, headerSelector);
        const trigger = findOwnedElement<HTMLButtonElement>(
          item,
          triggerSelector,
        );
        const content = findOwnedElement<HTMLElement>(item, contentSelector);
        const value = item.dataset.value;

        if (!trigger || !content || value === undefined) {
          return [];
        }

        this.#syncAuthoredTriggerDisabled(trigger);

        return [
          {
            item,
            header,
            trigger,
            content,
            value,
            disabled:
              this.disabled ||
              item.hasAttribute("data-item-disabled") ||
              this.#authoredTriggerDisabled.get(trigger) === true,
          },
        ];
      });
  }

  #syncAuthoredTriggerDisabled(trigger: HTMLButtonElement): void {
    const lastApplied = this.#lastAppliedTriggerDisabled.get(trigger);
    const currentlyDisabled = trigger.disabled;

    if (lastApplied === undefined) {
      this.#authoredTriggerDisabled.set(trigger, currentlyDisabled);
      return;
    }

    if (currentlyDisabled !== lastApplied) {
      this.#authoredTriggerDisabled.set(trigger, currentlyDisabled);
    }
  }

  #prepareParts(): void {
    if (!this.id) {
      generatedId += 1;
      this.id = `ormo-accordion-${generatedId}`;
    }

    this.#getParts().forEach(
      ({ item, header, trigger, content, disabled }, index) => {
        const indexValue = String(index);

        trigger.id ||= `${this.id}-trigger-${index + 1}`;
        content.id ||= `${this.id}-content-${index + 1}`;

        trigger.disabled = disabled;
        this.#lastAppliedTriggerDisabled.set(trigger, disabled);
        trigger.setAttribute("aria-controls", content.id);
        content.setAttribute("aria-labelledby", trigger.id);
        content.dataset.orientation =
          this.dataset.orientation === "horizontal" ? "horizontal" : "vertical";

        for (const part of [item, header, trigger, content]) {
          part?.toggleAttribute("data-disabled", disabled);

          if (part) {
            part.dataset.index = indexValue;
          }
        }
      },
    );
  }

  #observeContentSizes(): void {
    this.#resizeObserver?.disconnect();

    if (typeof ResizeObserver === "undefined") {
      this.#resizeObserver = undefined;
      return;
    }

    this.#resizeObserver ??= new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target instanceof HTMLElement) {
          setAccordionContentWidth(entry.target, contentWidthProperty);
        }
      }
    });

    for (const { content } of this.#getParts()) {
      this.#resizeObserver.observe(content);
    }
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

  #contentHiddenUntilFound(content: HTMLElement): boolean {
    const override = content.getAttribute("data-hidden-until-found");

    if (override === "false") return false;
    if (override !== null) return true;
    return this.hiddenUntilFound;
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

    this.#getParts().forEach(
      ({ item, header, trigger, content, value: itemValue, disabled }) => {
        const open = selectedValues.has(itemValue);
        const state = open ? "open" : "closed";

        const stateChanged = content.dataset.state !== state;

        item.dataset.state = state;
        trigger.dataset.state = state;
        trigger.setAttribute("aria-expanded", String(open));

        if (open && this.#type === "single" && !this.#collapsible) {
          trigger.setAttribute("aria-disabled", "true");
        } else {
          trigger.removeAttribute("aria-disabled");
        }

        for (const part of [item, header, trigger, content]) {
          part?.toggleAttribute("data-open", open);
          part?.toggleAttribute("data-disabled", disabled);
        }

        if (!animate || stateChanged) {
          setAccordionContentState(content, open, {
            animate,
            fallbackFocus: trigger,
            heightProperty: contentHeightProperty,
            hiddenUntilFound: this.#contentHiddenUntilFound(content),
            widthProperty: contentWidthProperty,
          });
        }
      },
    );
  }

  #requestValue(value: AccordionValue): void {
    const normalizedValue = this.#normalizeValue(value);

    if (valuesEqual(this.value, normalizedValue)) {
      return;
    }

    this.#applyValue(normalizedValue);
    this.dispatchEvent(
      new CustomEvent("ormo:value-change", {
        bubbles: true,
        composed: true,
        detail: { value: normalizedValue },
      }),
    );
  }

  #handleClick = (event: MouseEvent): void => {
    const target = event.target;
    const trigger =
      target instanceof Element
        ? target.closest<HTMLButtonElement>(triggerSelector)
        : null;

    if (
      !trigger ||
      !belongsToRoot(trigger, this) ||
      this.disabled ||
      trigger.disabled
    ) {
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

  #handleBeforeMatch = (event: Event): void => {
    const target = event.target;
    const content =
      target instanceof Element
        ? target.closest<HTMLElement>(contentSelector)
        : null;

    if (!content || !belongsToRoot(content, this)) {
      return;
    }

    const part = this.#getParts().find(
      (candidate) => candidate.content === content,
    );

    if (!part || part.item.dataset.state === "open") return;

    if (this.#type === "multiple") {
      this.#requestValue([...(this.value as string[]), part.value]);
    } else {
      this.#requestValue(part.value);
    }
  };
}

if (!customElements.get(tagName)) {
  customElements.define(tagName, OrmoAccordion);
}
