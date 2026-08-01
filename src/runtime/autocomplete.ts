import type {
  AutocompleteAlign,
  AutocompleteBeforeValueChangeDetail,
  AutocompleteFilter,
  AutocompleteOpenChangeDetail,
  AutocompleteOpenChangeReason,
  AutocompleteSelectDetail,
  AutocompleteSide,
  AutocompleteValueChangeDetail,
  AutocompleteValueChangeReason,
} from "../components/autocomplete/types";
import "./autocomplete.css";

const tagName = "ormo-autocomplete";
const inputSelector = "[data-ormo-autocomplete-input]";
const clearSelector = "[data-ormo-autocomplete-clear]";
const contentSelector = "[data-ormo-autocomplete-content]";
const itemSelector = "[data-ormo-autocomplete-item]";
const loadingSelector = "[data-ormo-autocomplete-loading]";
const emptySelector = "[data-ormo-autocomplete-empty]";
const groupSelector = "[data-ormo-autocomplete-group]";
const groupLabelSelector = "[data-ormo-autocomplete-group-label]";
const separatorSelector = "[data-ormo-autocomplete-separator]";
let generatedId = 0;

export interface AutocompletePositionerContext {
  root: HTMLElement;
  trigger: HTMLElement;
  content: HTMLElement;
  side: AutocompleteSide;
  align: AutocompleteAlign;
  sideOffset: number;
}
export type AutocompletePositionerCleanup = () => void;
export type AutocompletePositioner = (
  context: AutocompletePositionerContext,
) => AutocompletePositionerCleanup | void;

const positionerKey = "__ormoAutocompleteFloatingPositioner";
type Registry = typeof globalThis & {
  [positionerKey]?: AutocompletePositioner;
};
function getPositioner(): AutocompletePositioner | undefined {
  return (globalThis as Registry)[positionerKey];
}
export function registerAutocompleteFloatingPositioner(
  positioner: AutocompletePositioner,
): void {
  (globalThis as Registry)[positionerKey] = positioner;
}

function isOpen(content: HTMLElement): boolean {
  try {
    return (
      content.matches(":popover-open") || content.hasAttribute("data-open")
    );
  } catch {
    return content.hasAttribute("data-open");
  }
}
function normalize(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}
function itemValue(item: HTMLElement): string {
  return item.dataset.value ?? "";
}
function itemText(item: HTMLElement): string {
  return (item.dataset.textValue || item.textContent || "").trim();
}
function itemKeywords(item: HTMLElement): string[] {
  return item.dataset.keywords?.split("\u001f").filter(Boolean) ?? [];
}
function isDisabled(item: HTMLElement): boolean {
  return item.hasAttribute("data-disabled");
}
function side(value?: string): AutocompleteSide {
  return value === "top" || value === "right" || value === "left"
    ? value
    : "bottom";
}
function align(value?: string): AutocompleteAlign {
  return value === "center" || value === "end" ? value : "start";
}
function offset(content: HTMLElement): number {
  const value = Number.parseFloat(
    content.style.getPropertyValue("--ormo-autocomplete-side-offset"),
  );
  return Number.isFinite(value) ? value : 0;
}

export function validateAutocomplete(root: HTMLElement): void {
  if (!import.meta.env.DEV) return;
  const input = root.querySelector<HTMLInputElement>(inputSelector);
  if (!input) console.warn("[Ormo Autocomplete] Add Autocomplete.Input.", root);
  else if (
    !input.labels?.length &&
    !input.hasAttribute("aria-label") &&
    !input.hasAttribute("aria-labelledby")
  ) {
    console.warn("[Ormo Autocomplete] Give Input an accessible name.", root);
  }
  if (!root.querySelector(contentSelector)) {
    console.warn("[Ormo Autocomplete] Add Autocomplete.Content.", root);
  }
  if (root.dataset.positioning === "floating" && !getPositioner()) {
    console.warn(
      '[Ormo Autocomplete] positioning="floating" requires the autocomplete/floating entry.',
      root,
    );
  }
  for (const group of root.querySelectorAll(groupSelector)) {
    if (!group.querySelector(groupLabelSelector)) {
      console.warn(
        "[Ormo Autocomplete] Every Group needs a GroupLabel.",
        group,
      );
    }
  }
}

export class OrmoAutocomplete extends HTMLElement {
  #controller: AbortController | undefined;
  #observer: MutationObserver | undefined;
  #active: HTMLElement | undefined;
  #lastValue = "";
  #pendingReason: AutocompleteOpenChangeReason = "programmatic";
  #positionerCleanup: AutocompletePositionerCleanup | undefined;
  #authoredAttributes = new Map<Element, Map<string, string | null>>();
  #authoredValue: string | undefined;
  #composing = false;

  connectedCallback(): void {
    this.#snapshot(this, [
      "id",
      "data-enhanced",
      "data-state",
      "data-open",
      "data-filtered",
    ]);
    this.#controller?.abort();
    this.#controller = new AbortController();
    this.#prepare();
    const signal = this.#controller.signal;
    this.addEventListener("click", this.#onClick, { signal });
    this.addEventListener("pointermove", this.#onPointerMove, { signal });
    this.addEventListener("keydown", this.#onKeyDown, { signal });
    this.#input?.addEventListener("input", this.#onInput, { signal });
    this.#input?.addEventListener(
      "compositionstart",
      this.#onCompositionStart,
      {
        signal,
      },
    );
    this.#input?.addEventListener("compositionend", this.#onCompositionEnd, {
      signal,
    });
    this.#content?.addEventListener("toggle", this.#onToggle, { signal });
    this.#input?.form?.addEventListener("reset", this.#onReset, { signal });
    this.ownerDocument.addEventListener(
      "astro:before-swap",
      this.#onBeforeSwap,
      { signal },
    );
    this.#observer?.disconnect();
    this.#observer = new MutationObserver(() => {
      this.#prepare();
      this.#filterItems();
    });
    this.#observer.observe(this, { childList: true, subtree: true });
  }

  disconnectedCallback(): void {
    if (this.#content && this.open) {
      try {
        this.#content.hidePopover();
      } catch {
        this.#content.hidden = true;
      }
    }
    this.#controller?.abort();
    this.#controller = undefined;
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#stopPositioner();
    this.#active = undefined;
    this.#composing = false;
    this.#restore();
  }

  get value(): string {
    return this.#input?.value ?? "";
  }
  set value(value: string) {
    if (this.#setValue(String(value), "programmatic")) this.#filterItems();
  }
  get disabled(): boolean {
    return this.hasAttribute("data-disabled");
  }
  set disabled(value: boolean) {
    if (value) this.#hide("programmatic");
    this.toggleAttribute("data-disabled", Boolean(value));
    this.#prepare();
  }
  get readOnly(): boolean {
    return this.hasAttribute("data-readonly") || Boolean(this.#input?.readOnly);
  }
  set readOnly(value: boolean) {
    if (value) this.#hide("programmatic");
    this.toggleAttribute("data-readonly", Boolean(value));
    if (this.#input) this.#input.readOnly = Boolean(value);
    this.#prepare();
  }
  get loading(): boolean {
    return this.hasAttribute("data-loading");
  }
  set loading(value: boolean) {
    this.toggleAttribute("data-loading", Boolean(value));
    this.#filterItems();
  }
  get open(): boolean {
    return this.#content ? isOpen(this.#content) : false;
  }
  show(): void {
    this.#show("programmatic", true);
  }
  hide(): void {
    this.#hide("programmatic");
  }
  toggle(force?: boolean): void {
    if (force === true || (force === undefined && !this.open)) this.show();
    else if (force === false || force === undefined) this.hide();
  }

  get #input(): HTMLInputElement | undefined {
    return this.querySelector(inputSelector) ?? undefined;
  }
  get #content(): HTMLElement | undefined {
    return this.querySelector(contentSelector) ?? undefined;
  }
  get #items(): HTMLElement[] {
    return Array.from(this.querySelectorAll(itemSelector));
  }
  get #visibleItems(): HTMLElement[] {
    return this.#items.filter((item) => !item.hidden && !isDisabled(item));
  }
  get #minLength(): number {
    return Math.max(0, Number.parseInt(this.dataset.minLength ?? "0", 10) || 0);
  }
  get #filter(): AutocompleteFilter {
    return this.dataset.filter === "startsWith" ||
      this.dataset.filter === "none"
      ? this.dataset.filter
      : "contains";
  }

  #prepare(): void {
    const input = this.#input;
    const content = this.#content;
    if (!input || !content) {
      this.removeAttribute("data-enhanced");
      validateAutocomplete(this);
      return;
    }
    this.#snapshot(input, [
      "id",
      "aria-controls",
      "aria-expanded",
      "aria-activedescendant",
      "aria-invalid",
      "aria-busy",
      "disabled",
      "readonly",
      "data-disabled",
      "data-readonly",
      "data-state",
      "data-placeholder",
      "style",
    ]);
    this.#authoredValue ??= input.value;
    this.#snapshot(content, [
      "id",
      "aria-busy",
      "data-state",
      "data-open",
      "data-disabled",
      "data-readonly",
      "data-ormo-autocomplete-positioning",
      "data-resolved-side",
      "data-resolved-align",
      "hidden",
      "style",
    ]);
    for (const button of this.querySelectorAll(clearSelector))
      this.#snapshot(button, [
        "aria-controls",
        "aria-expanded",
        "disabled",
        "hidden",
        "data-disabled",
        "data-readonly",
        "data-state",
      ]);
    for (const item of this.#items)
      this.#snapshot(item, [
        "id",
        "aria-selected",
        "data-highlighted",
        "hidden",
      ]);
    for (const part of this.querySelectorAll(
      `${groupSelector}, ${separatorSelector}, ${emptySelector}, ${loadingSelector}`,
    ))
      this.#snapshot(part, ["hidden"]);
    const baseId = this.id || `ormo-autocomplete-${++generatedId}`;
    this.id ||= baseId;
    input.id ||= `${baseId}-input`;
    content.id ||= `${baseId}-content`;
    input.setAttribute("aria-controls", content.id);
    input.setAttribute("aria-expanded", this.open ? "true" : "false");
    const disabled = this.disabled;
    const readOnly = this.readOnly;
    input.disabled = disabled;
    input.readOnly = readOnly;
    input.toggleAttribute("data-disabled", disabled);
    input.toggleAttribute("data-readonly", readOnly);
    content.toggleAttribute("data-disabled", disabled);
    content.toggleAttribute("data-readonly", readOnly);
    for (const clear of this.querySelectorAll<HTMLButtonElement>(
      clearSelector,
    )) {
      clear.disabled =
        disabled ||
        readOnly ||
        clear.hasAttribute("data-item-disabled") ||
        !input.value;
      clear.hidden = !input.value;
      clear.toggleAttribute("data-disabled", clear.disabled);
      clear.toggleAttribute("data-readonly", readOnly);
    }
    const anchor = `--${baseId}-anchor`;
    input.style.setProperty("anchor-name", anchor);
    content.style.setProperty("--ormo-autocomplete-anchor", anchor);
    for (const [index, item] of this.#items.entries())
      item.id ||= `${baseId}-item-${index + 1}`;
    this.setAttribute("data-enhanced", "");
    this.#lastValue = input.value;
    this.#filterItems();
    validateAutocomplete(this);
  }

  #snapshot(element: Element, names: string[]): void {
    let values = this.#authoredAttributes.get(element);
    if (!values) {
      values = new Map();
      this.#authoredAttributes.set(element, values);
    }
    for (const name of names)
      if (!values.has(name)) values.set(name, element.getAttribute(name));
  }
  #restore(): void {
    for (const [element, values] of this.#authoredAttributes) {
      for (const [name, value] of values) {
        if (value === null) element.removeAttribute(name);
        else element.setAttribute(name, value);
      }
    }
    if (this.#input && this.#authoredValue !== undefined)
      this.#input.value = this.#authoredValue;
    this.#authoredAttributes.clear();
    this.#authoredValue = undefined;
  }

  #emitValue(
    previousValue: string,
    reason: AutocompleteValueChangeReason,
    identifier?: string,
  ): void {
    const detail: AutocompleteValueChangeDetail = {
      value: this.value,
      previousValue,
      reason,
      ...(identifier ? { identifier } : {}),
    };
    this.dispatchEvent(
      new CustomEvent("ormo:autocomplete-value-change", {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  }
  #before(
    value: string,
    previousValue: string,
    reason: Exclude<AutocompleteValueChangeReason, "programmatic">,
    identifier?: string,
  ): boolean {
    const detail: AutocompleteBeforeValueChangeDetail = {
      value,
      previousValue,
      reason,
      ...(identifier ? { identifier } : {}),
    };
    return this.dispatchEvent(
      new CustomEvent("ormo:autocomplete-before-value-change", {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail,
      }),
    );
  }
  #setValue(
    value: string,
    reason: AutocompleteValueChangeReason,
    identifier?: string,
    nativeEvents = false,
  ): boolean {
    const input = this.#input;
    if (!input || input.value === value) return false;
    const previous = input.value;
    if (
      reason !== "programmatic" &&
      !this.#before(value, previous, reason, identifier)
    )
      return false;
    input.value = value;
    this.#lastValue = value;
    this.#synchronizeValue();
    if (nativeEvents) {
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    this.#emitValue(previous, reason, identifier);
    return true;
  }
  #synchronizeValue(): void {
    const input = this.#input;
    if (!input) return;
    input.toggleAttribute("data-placeholder", !input.value);
    for (const clear of this.querySelectorAll<HTMLButtonElement>(
      clearSelector,
    )) {
      clear.disabled =
        this.disabled ||
        this.readOnly ||
        clear.hasAttribute("data-item-disabled") ||
        !input.value;
      clear.hidden = !input.value;
      clear.toggleAttribute("data-disabled", clear.disabled);
    }
  }

  #filterItems(): void {
    const query = normalize(this.value);
    const eligible = query.length >= this.#minLength;
    for (const item of this.#items) {
      const candidates = [itemText(item), ...itemKeywords(item)].map(normalize);
      const match =
        this.#filter === "none" ||
        !query ||
        candidates.some((candidate) =>
          this.#filter === "startsWith"
            ? candidate.startsWith(query)
            : candidate.includes(query),
        );
      item.hidden = !eligible || !match;
    }
    for (const group of this.querySelectorAll<HTMLElement>(groupSelector))
      group.hidden = !Array.from(
        group.querySelectorAll<HTMLElement>(itemSelector),
      ).some((item) => !item.hidden);
    const visible = this.#items.filter((item) => !item.hidden).length;
    for (const loading of this.querySelectorAll<HTMLElement>(loadingSelector))
      loading.hidden = !eligible || !this.loading;
    for (const empty of this.querySelectorAll<HTMLElement>(emptySelector))
      empty.hidden = !eligible || this.loading || visible > 0;
    for (const separator of this.querySelectorAll<HTMLElement>(
      separatorSelector,
    )) {
      const next = separator.hasAttribute("data-automatic")
        ? separator.nextElementSibling
        : undefined;
      separator.hidden =
        !eligible ||
        visible === 0 ||
        (next instanceof HTMLElement && next.hidden);
    }
    this.#content?.setAttribute("aria-busy", this.loading ? "true" : "false");
    this.toggleAttribute("data-filtered", Boolean(query));
    this.toggleAttribute("data-query-eligible", eligible);
    if (
      this.#active &&
      (!this.contains(this.#active) ||
        this.#active.hidden ||
        isDisabled(this.#active))
    )
      this.#highlight(undefined);
  }

  #highlight(item?: HTMLElement): void {
    for (const candidate of this.#items) {
      candidate.toggleAttribute("data-highlighted", candidate === item);
      candidate.setAttribute(
        "aria-selected",
        candidate === item ? "true" : "false",
      );
    }
    this.#active = item;
    if (item) {
      this.#input?.setAttribute("aria-activedescendant", item.id);
      item.scrollIntoView?.({ block: "nearest" });
    } else this.#input?.removeAttribute("aria-activedescendant");
  }
  #move(delta: number): void {
    const items = this.#visibleItems;
    if (!items.length) return;
    const current = this.#active ? items.indexOf(this.#active) : -1;
    const index =
      current < 0
        ? delta > 0
          ? 0
          : items.length - 1
        : Math.max(0, Math.min(items.length - 1, current + delta));
    this.#highlight(items[index]);
  }
  #select(item: HTMLElement): void {
    if (
      this.disabled ||
      this.readOnly ||
      !this.contains(item) ||
      item.hidden ||
      isDisabled(item)
    )
      return;
    const value = itemValue(item);
    const identifier = item.dataset.identifier;
    if (
      this.#setValue(value, "item", identifier, true) ||
      value === this.value
    ) {
      const detail: AutocompleteSelectDetail = {
        value,
        ...(identifier ? { identifier } : {}),
      };
      this.dispatchEvent(
        new CustomEvent("ormo:autocomplete-select", {
          bubbles: true,
          composed: true,
          detail,
        }),
      );
      this.#hide("selection");
      this.#input?.focus();
    }
  }

  #show(reason: AutocompleteOpenChangeReason, highlight: boolean): void {
    if (
      this.disabled ||
      this.readOnly ||
      this.open ||
      !this.#content ||
      this.value.length < this.#minLength
    )
      return;
    this.#filterItems();
    this.#pendingReason = reason;
    this.#highlight(highlight ? this.#visibleItems[0] : undefined);
    this.#measure();
    try {
      this.#content.showPopover();
    } catch {
      this.#content.hidden = false;
      this.#content.setAttribute("data-open", "");
      this.#syncOpen(true, reason);
    }
  }
  #hide(reason: AutocompleteOpenChangeReason): void {
    if (!this.open || !this.#content) return;
    this.#pendingReason = reason;
    try {
      this.#content.hidePopover();
    } catch {
      this.#content.hidden = true;
      this.#content.removeAttribute("data-open");
      this.#syncOpen(false, reason);
    }
  }
  #syncOpen(open: boolean, reason: AutocompleteOpenChangeReason): void {
    this.dataset.state = open ? "open" : "closed";
    this.toggleAttribute("data-open", open);
    this.#input?.setAttribute("aria-expanded", open ? "true" : "false");
    if (this.#input) this.#input.dataset.state = open ? "open" : "closed";
    if (this.#content) this.#content.dataset.state = open ? "open" : "closed";
    if (open) this.#startPositioner();
    else {
      this.#stopPositioner();
      this.#highlight(undefined);
    }
    const detail: AutocompleteOpenChangeDetail = { open, reason };
    this.dispatchEvent(
      new CustomEvent("ormo:autocomplete-open-change", {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  }
  #measure(): void {
    if (!this.#input || !this.#content) return;
    const input = this.#input.getBoundingClientRect();
    const clearElement = this.querySelector<HTMLElement>(clearSelector);
    const clear = clearElement?.getBoundingClientRect();
    const width =
      clear && !clearElement?.hidden
        ? Math.max(input.right, clear.right) - Math.min(input.left, clear.left)
        : input.width;
    const height = clear ? Math.max(input.height, clear.height) : input.height;
    this.#content.style.setProperty(
      "--ormo-autocomplete-trigger-width",
      `${width}px`,
    );
    this.#content.style.setProperty(
      "--ormo-autocomplete-trigger-height",
      `${height}px`,
    );
  }
  #startPositioner(): void {
    this.#stopPositioner();
    this.#measure();
    if (
      this.dataset.positioning !== "floating" ||
      !this.#input ||
      !this.#content
    )
      return;
    const positioner = getPositioner();
    if (!positioner) return;
    this.#content.setAttribute(
      "data-ormo-autocomplete-positioning",
      "floating",
    );
    this.#positionerCleanup =
      positioner({
        root: this,
        trigger: this.#input,
        content: this.#content,
        side: side(this.#content.dataset.side),
        align: align(this.#content.dataset.align),
        sideOffset: offset(this.#content),
      }) ?? undefined;
  }
  #stopPositioner(): void {
    this.#positionerCleanup?.();
    this.#positionerCleanup = undefined;
    this.#content?.removeAttribute("data-ormo-autocomplete-positioning");
    this.#content?.style.removeProperty("--ormo-autocomplete-trigger-width");
    this.#content?.style.removeProperty("--ormo-autocomplete-trigger-height");
  }

  #processInput(): void {
    const next = this.value;
    const previous = this.#lastValue;
    if (next === previous) return;
    if (next !== previous && !this.#before(next, previous, "input")) {
      if (this.#input) this.#input.value = previous;
      return;
    }
    this.#lastValue = next;
    this.#synchronizeValue();
    this.#emitValue(previous, "input");
    this.#filterItems();
    if (next.length >= this.#minLength) this.#show("input", false);
    else this.#hide("input");
  }
  #onInput = (event: Event): void => {
    if (this.#composing || (event instanceof InputEvent && event.isComposing))
      return;
    this.#processInput();
  };
  #onClick = (event: MouseEvent): void => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest(clearSelector)) {
      if (this.disabled || this.readOnly) return;
      if (this.#setValue("", "clear", undefined, true)) {
        this.#filterItems();
        this.#hide("selection");
      }
      this.#input?.focus();
      return;
    }
    const item = event.target.closest<HTMLElement>(itemSelector);
    if (item && this.contains(item)) this.#select(item);
  };
  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.target !== this.#input || this.disabled) return;
    if (this.#composing || event.isComposing || event.key === "Process") return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!this.open) this.#show("input", true);
      else this.#move(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Enter" && this.open && this.#active) {
      event.preventDefault();
      this.#select(this.#active);
      return;
    }
    if (event.key === "Escape" && this.open) {
      event.preventDefault();
      this.#hide("escape");
      return;
    }
    if (event.key === "Tab" && this.open) this.#hide("tab");
  };
  #onPointerMove = (event: PointerEvent): void => {
    if (
      !this.open ||
      this.disabled ||
      this.readOnly ||
      !(event.target instanceof Element)
    )
      return;
    const item = event.target.closest<HTMLElement>(itemSelector);
    if (item && this.contains(item) && !item.hidden && !isDisabled(item))
      this.#highlight(item);
  };
  #onToggle = (): void => {
    const open = this.open;
    const reason = this.#pendingReason;
    this.#syncOpen(open, reason);
    this.#pendingReason = open ? "outside" : "programmatic";
  };
  #onCompositionStart = (): void => {
    this.#composing = true;
  };
  #onCompositionEnd = (): void => {
    if (!this.#composing) return;
    this.#composing = false;
    this.#processInput();
  };
  #onReset = (): void => {
    queueMicrotask(() => {
      this.#lastValue = this.value;
      this.#synchronizeValue();
      this.#filterItems();
      this.#hide("programmatic");
    });
  };
  #onBeforeSwap = (): void => {
    this.#stopPositioner();
    if (this.open) this.#hide("programmatic");
  };
}

if (!customElements.get(tagName))
  customElements.define(tagName, OrmoAutocomplete);
