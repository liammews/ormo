import type {
  ComboboxAlign,
  ComboboxBeforeValueChangeDetail,
  ComboboxChangeReason,
  ComboboxFilter,
  ComboboxInputChangeReason,
  ComboboxInputValueChangeDetail,
  ComboboxOpenChangeDetail,
  ComboboxOpenChangeReason,
  ComboboxSide,
  ComboboxValueChangeDetail,
} from "../components/combobox/types";
import {
  getCollectionItems,
  moveCollectionItem,
} from "./collection-navigation";
import "./combobox.css";

const tagName = "ormo-combobox";
const controlSelector = "[data-ormo-combobox-control]";
const inputSelector = "[data-ormo-combobox-input]";
const toggleSelector = "[data-ormo-combobox-toggle]";
const clearSelector = "[data-ormo-combobox-clear]";
const contentSelector = "[data-ormo-combobox-content]";
const itemSelector = "[data-ormo-combobox-item]";
const emptySelector = "[data-ormo-combobox-empty]";
const groupSelector = "[data-ormo-combobox-group]";
const groupLabelSelector = "[data-ormo-combobox-group-label]";
const separatorSelector = "[data-ormo-combobox-separator]";

let generatedId = 0;

export interface ComboboxPositionerContext {
  root: HTMLElement;
  trigger: HTMLElement;
  content: HTMLElement;
  side: ComboboxSide;
  align: ComboboxAlign;
  sideOffset: number;
}
export type ComboboxPositionerCleanup = () => void;
export type ComboboxPositioner = (
  context: ComboboxPositionerContext,
) => ComboboxPositionerCleanup | void;

const floatingPositionerKey = "__ormoComboboxFloatingPositioner";
type ComboboxGlobalRegistry = typeof globalThis & {
  [floatingPositionerKey]?: ComboboxPositioner;
};

function getFloatingPositioner(): ComboboxPositioner | undefined {
  return (globalThis as ComboboxGlobalRegistry)[floatingPositionerKey];
}

export function registerComboboxFloatingPositioner(
  positioner: ComboboxPositioner,
): void {
  (globalThis as ComboboxGlobalRegistry)[floatingPositionerKey] = positioner;
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

function normalizeSearch(value: string): string {
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

function isItemDisabled(item: HTMLElement): boolean {
  return item.hasAttribute("data-disabled");
}

function parseSide(value: string | undefined): ComboboxSide {
  return value === "top" || value === "right" || value === "left"
    ? value
    : "bottom";
}

function parseAlign(value: string | undefined): ComboboxAlign {
  return value === "center" || value === "end" ? value : "start";
}

function parseSideOffset(content: HTMLElement): number {
  const parsed = Number.parseFloat(
    content.style.getPropertyValue("--ormo-combobox-side-offset"),
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

export function validateCombobox(root: HTMLElement): void {
  if (!import.meta.env.DEV) return;
  const input = root.querySelector<HTMLInputElement>(inputSelector);
  const content = root.querySelector<HTMLElement>(contentSelector);
  const items = root.querySelectorAll<HTMLElement>(itemSelector);

  if (!input) {
    console.warn("[Ormo Combobox] Add Combobox.Input.", root);
  } else if (
    !input.hasAttribute("aria-label") &&
    !input.hasAttribute("aria-labelledby") &&
    !root.querySelector<HTMLSelectElement>(controlSelector)?.labels?.length
  ) {
    console.warn(
      "[Ormo Combobox] Give Combobox.Input an accessible name or label the Root control.",
      root,
    );
  }
  if (!content) console.warn("[Ormo Combobox] Add Combobox.Content.", root);
  if (!items.length)
    console.warn("[Ormo Combobox] Add at least one Item.", root);
  if (root.dataset.positioning === "floating" && !getFloatingPositioner()) {
    console.warn(
      '[Ormo Combobox] positioning="floating" requires `import "@ormo/primitives/combobox/floating"`.',
      root,
    );
  }
  for (const group of root.querySelectorAll<HTMLElement>(groupSelector)) {
    if (!group.querySelector(groupLabelSelector)) {
      console.warn("[Ormo Combobox] Every Group needs a GroupLabel.", group);
    }
  }
}

export class OrmoCombobox extends HTMLElement {
  #controller: AbortController | undefined;
  #observer: MutationObserver | undefined;
  #activeItem: HTMLElement | undefined;
  #pendingOpenReason: ComboboxOpenChangeReason = "programmatic";
  #positionerCleanup: ComboboxPositionerCleanup | undefined;
  #lastInputValue = "";
  #authoredAttributes = new Map<Element, Map<string, string | null>>();
  #authoredInputValue: string | undefined;

  connectedCallback(): void {
    this.#snapshotAttributes(this, [
      "id",
      "data-enhanced",
      "data-state",
      "data-open",
      "data-filtered",
    ]);
    this.#controller?.abort();
    this.#controller = new AbortController();
    this.#prepare();

    this.addEventListener("click", this.#handleClick, {
      signal: this.#controller.signal,
    });
    this.addEventListener("pointerdown", this.#handlePointerDown, {
      signal: this.#controller.signal,
    });
    this.addEventListener("keydown", this.#handleKeyDown, {
      signal: this.#controller.signal,
    });
    this.addEventListener("pointermove", this.#handlePointerMove, {
      signal: this.#controller.signal,
    });
    this.#input?.addEventListener("input", this.#handleInput, {
      signal: this.#controller.signal,
    });
    this.#content?.addEventListener("toggle", this.#handleToggle, {
      signal: this.#controller.signal,
    });
    this.#control?.addEventListener("input", this.#handleNativeChange, {
      signal: this.#controller.signal,
    });
    this.#control?.addEventListener("change", this.#handleNativeChange, {
      signal: this.#controller.signal,
    });
    this.#control?.addEventListener("focus", this.#redirectControlFocus, {
      signal: this.#controller.signal,
    });
    this.#control?.addEventListener("invalid", this.#handleInvalid, {
      signal: this.#controller.signal,
    });
    this.#control?.form?.addEventListener("reset", this.#handleFormReset, {
      signal: this.#controller.signal,
    });
    this.ownerDocument.addEventListener(
      "astro:before-swap",
      this.#handleBeforeSwap,
      { signal: this.#controller.signal },
    );

    this.#observer?.disconnect();
    this.#observer = new MutationObserver((records) => {
      if (
        records.every(
          (record) =>
            record.target instanceof Element &&
            Boolean(
              record.target.closest(inputSelector) ||
              record.target.closest(controlSelector),
            ),
        )
      ) {
        return;
      }
      this.#rebuildControlOptions();
      this.#prepare();
    });
    this.#observer.observe(this, { childList: true, subtree: true });
  }

  disconnectedCallback(): void {
    const content = this.#content;
    if (content && this.open) {
      try {
        content.hidePopover();
      } catch {
        content.hidden = true;
        content.removeAttribute("data-open");
      }
    }
    this.#controller?.abort();
    this.#controller = undefined;
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#stopPositioner();
    this.#activeItem = undefined;
    this.#restoreAuthoredState();
  }

  get value(): string {
    return this.#control?.value ?? "";
  }

  set value(value: string) {
    this.#setValue(String(value), "programmatic", false);
  }

  get inputValue(): string {
    return this.#input?.value ?? "";
  }

  set inputValue(value: string) {
    this.#setInputValue(String(value), "programmatic");
    this.#filterItems();
  }

  get disabled(): boolean {
    return this.hasAttribute("data-disabled");
  }

  set disabled(value: boolean) {
    this.toggleAttribute("data-disabled", Boolean(value));
    this.#prepare();
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

  get #control(): HTMLSelectElement | undefined {
    return this.querySelector<HTMLSelectElement>(controlSelector) ?? undefined;
  }
  get #input(): HTMLInputElement | undefined {
    return this.querySelector<HTMLInputElement>(inputSelector) ?? undefined;
  }
  get #content(): HTMLElement | undefined {
    return this.querySelector<HTMLElement>(contentSelector) ?? undefined;
  }
  get #items(): HTMLElement[] {
    return getCollectionItems(this, itemSelector);
  }
  get #visibleEnabledItems(): HTMLElement[] {
    return this.#items.filter((item) => !item.hidden && !isItemDisabled(item));
  }
  get #filter(): ComboboxFilter {
    return this.dataset.filter === "startsWith" ||
      this.dataset.filter === "none"
      ? this.dataset.filter
      : "contains";
  }

  #prepare(): void {
    const control = this.#control;
    const input = this.#input;
    const content = this.#content;
    if (!control || !input || !content) {
      this.removeAttribute("data-enhanced");
      validateCombobox(this);
      return;
    }

    this.#snapshotAttributes(control, [
      "id",
      "disabled",
      "tabindex",
      "aria-hidden",
      "hidden",
    ]);
    this.#snapshotAttributes(input, [
      "id",
      "aria-controls",
      "aria-expanded",
      "aria-required",
      "aria-labelledby",
      "aria-activedescendant",
      "aria-invalid",
      "disabled",
      "data-disabled",
      "data-state",
      "data-placeholder",
      "style",
    ]);
    this.#authoredInputValue ??= input.value;
    this.#snapshotAttributes(content, [
      "id",
      "data-disabled",
      "data-state",
      "data-open",
      "data-ormo-combobox-positioning",
      "data-resolved-side",
      "data-resolved-align",
      "hidden",
      "style",
    ]);
    for (const label of Array.from(control.labels ?? [])) {
      this.#snapshotAttributes(label, ["id"]);
    }
    for (const toggle of this.querySelectorAll(toggleSelector)) {
      this.#snapshotAttributes(toggle, [
        "aria-controls",
        "aria-expanded",
        "disabled",
        "data-disabled",
        "data-state",
      ]);
    }
    for (const clear of this.querySelectorAll(clearSelector)) {
      this.#snapshotAttributes(clear, ["disabled", "data-disabled", "hidden"]);
    }
    for (const item of this.#items) {
      this.#snapshotAttributes(item, [
        "id",
        "aria-selected",
        "data-selected",
        "data-highlighted",
        "hidden",
      ]);
    }
    for (const part of this.querySelectorAll(
      `${groupSelector}, ${separatorSelector}, ${emptySelector}`,
    )) {
      this.#snapshotAttributes(part, ["hidden"]);
    }

    const baseId = this.id || `ormo-combobox-${++generatedId}`;
    if (!this.id) this.id = baseId;
    control.id ||= `${baseId}-control`;
    input.id ||= `${baseId}-input`;
    content.id ||= `${baseId}-content`;
    input.setAttribute("aria-controls", content.id);
    input.setAttribute("aria-expanded", this.open ? "true" : "false");
    input.setAttribute("aria-required", control.required ? "true" : "false");
    for (const toggle of this.querySelectorAll<HTMLElement>(toggleSelector)) {
      toggle.setAttribute("aria-controls", content.id);
      toggle.setAttribute("aria-expanded", this.open ? "true" : "false");
    }

    const labels = Array.from(control.labels ?? []);
    for (const [index, label] of labels.entries()) {
      label.id ||= `${baseId}-label-${index + 1}`;
    }
    if (
      labels.length &&
      !input.hasAttribute("aria-label") &&
      !input.hasAttribute("aria-labelledby")
    ) {
      input.setAttribute(
        "aria-labelledby",
        labels.map((label) => label.id).join(" "),
      );
    }

    const disabled = this.disabled;
    control.disabled = disabled;
    input.disabled = disabled;
    input.toggleAttribute("data-disabled", disabled);
    content.toggleAttribute("data-disabled", disabled);
    for (const button of this.querySelectorAll<HTMLButtonElement>(
      `${toggleSelector}, ${clearSelector}`,
    )) {
      const authoredDisabled = button.hasAttribute("data-item-disabled");
      button.disabled = authoredDisabled || disabled;
      button.toggleAttribute("data-disabled", button.disabled);
    }

    const anchorName = `--${baseId}-anchor`;
    input.style.setProperty("anchor-name", anchorName);
    content.style.setProperty("--ormo-combobox-anchor", anchorName);
    for (const [index, item] of this.#items.entries()) {
      item.id ||= `${baseId}-item-${index + 1}`;
    }

    control.hidden = false;
    control.tabIndex = -1;
    control.setAttribute("aria-hidden", "true");
    this.setAttribute("data-enhanced", "");
    this.#synchronizeValue();
    this.#lastInputValue = input.value;
    this.#filterItems();
    validateCombobox(this);
  }

  #snapshotAttributes(element: Element, names: string[]): void {
    let snapshot = this.#authoredAttributes.get(element);
    if (!snapshot) {
      snapshot = new Map();
      this.#authoredAttributes.set(element, snapshot);
    }
    for (const name of names) {
      if (!snapshot.has(name)) snapshot.set(name, element.getAttribute(name));
    }
  }

  #restoreAuthoredState(): void {
    for (const [element, attributes] of this.#authoredAttributes) {
      for (const [name, value] of attributes) {
        if (value === null) element.removeAttribute(name);
        else element.setAttribute(name, value);
      }
    }
    if (this.#input && this.#authoredInputValue !== undefined) {
      this.#input.value = this.#authoredInputValue;
    }
    this.#authoredAttributes.clear();
    this.#authoredInputValue = undefined;
  }

  #selectedItem(): HTMLElement | undefined {
    return this.#items.find((item) => itemValue(item) === this.value);
  }

  #selectedText(): string {
    return this.#selectedItem() ? itemText(this.#selectedItem()!) : "";
  }

  #synchronizeValue(): void {
    const selected = this.#selectedItem();
    for (const item of this.#items) {
      const isSelected = item === selected;
      item.setAttribute("aria-selected", isSelected ? "true" : "false");
      item.toggleAttribute("data-selected", isSelected);
    }
    this.#setInputValue(selected ? itemText(selected) : "", "selection", false);
    this.#input?.toggleAttribute("data-placeholder", !selected);
    if (this.#control?.validity.valid) {
      this.#input?.removeAttribute("aria-invalid");
    }
    for (const clear of this.querySelectorAll<HTMLButtonElement>(
      clearSelector,
    )) {
      clear.disabled =
        clear.hasAttribute("data-item-disabled") || this.disabled || !selected;
      clear.hidden = !selected;
      clear.toggleAttribute("data-disabled", clear.disabled);
    }
  }

  #setValue(
    nextValue: string,
    reason: ComboboxChangeReason,
    emitNativeEvents: boolean,
  ): boolean {
    const control = this.#control;
    if (!control) return false;
    if (![...control.options].some((option) => option.value === nextValue)) {
      nextValue = "";
    }
    if (control.value === nextValue) return false;

    const previousValue = control.value;
    const previousInputValue = this.inputValue;
    if (reason !== "programmatic") {
      const detail: ComboboxBeforeValueChangeDetail = {
        value: nextValue,
        previousValue,
        reason,
      };
      if (
        !this.dispatchEvent(
          new CustomEvent("ormo:combobox-before-value-change", {
            bubbles: true,
            composed: true,
            cancelable: true,
            detail,
          }),
        )
      ) {
        return false;
      }
    }

    control.value = nextValue;
    this.#synchronizeValue();
    if (previousInputValue !== this.inputValue) {
      this.#emitInputValueChange(
        previousInputValue,
        this.inputValue,
        reason === "item"
          ? "selection"
          : reason === "clear"
            ? "clear"
            : "programmatic",
      );
    }
    if (emitNativeEvents) {
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const detail: ComboboxValueChangeDetail = {
      value: nextValue,
      previousValue,
      reason,
    };
    this.dispatchEvent(
      new CustomEvent("ormo:combobox-value-change", {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
    return true;
  }

  #setInputValue(
    value: string,
    reason: ComboboxInputChangeReason,
    emit = true,
  ): boolean {
    const input = this.#input;
    if (!input || input.value === value) return false;
    const previousInputValue = input.value;
    input.value = value;
    this.#lastInputValue = value;
    if (emit) {
      this.#emitInputValueChange(previousInputValue, value, reason);
    }
    return true;
  }

  #emitInputValueChange(
    previousInputValue: string,
    inputValue: string,
    reason: ComboboxInputChangeReason,
  ): void {
    const detail: ComboboxInputValueChangeDetail = {
      inputValue,
      previousInputValue,
      reason,
    };
    this.dispatchEvent(
      new CustomEvent("ormo:combobox-input-value-change", {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  }

  #filterItems(): void {
    const selectedText = this.#selectedText();
    const inputValue = this.inputValue;
    const query =
      selectedText && inputValue === selectedText
        ? ""
        : normalizeSearch(inputValue);
    const filter = this.#filter;

    for (const item of this.#items) {
      const candidates = [itemText(item), ...itemKeywords(item)].map(
        normalizeSearch,
      );
      const matches =
        !query ||
        filter === "none" ||
        candidates.some((candidate) =>
          filter === "startsWith"
            ? candidate.startsWith(query)
            : candidate.includes(query),
        );
      item.hidden = !matches;
    }

    for (const group of this.querySelectorAll<HTMLElement>(groupSelector)) {
      group.hidden = !Array.from(
        group.querySelectorAll<HTMLElement>(itemSelector),
      ).some((item) => !item.hidden);
    }
    const visibleCount = this.#items.filter((item) => !item.hidden).length;
    for (const empty of this.querySelectorAll<HTMLElement>(emptySelector)) {
      empty.hidden = visibleCount > 0;
    }
    for (const separator of this.querySelectorAll<HTMLElement>(
      separatorSelector,
    )) {
      const nextGroup = separator.hasAttribute("data-automatic")
        ? separator.nextElementSibling
        : undefined;
      separator.hidden =
        visibleCount === 0 ||
        (nextGroup instanceof HTMLElement && nextGroup.hidden);
    }
    this.toggleAttribute("data-filtered", Boolean(query));
    if (this.#activeItem?.hidden) this.#highlight(undefined);
  }

  #highlight(item: HTMLElement | undefined): void {
    for (const candidate of this.#items) {
      candidate.toggleAttribute("data-highlighted", candidate === item);
    }
    this.#activeItem = item;
    if (item) {
      this.#input?.setAttribute("aria-activedescendant", item.id);
      item.scrollIntoView?.({ block: "nearest" });
    } else {
      this.#input?.removeAttribute("aria-activedescendant");
    }
  }

  #moveHighlight(delta: number): void {
    const items = this.#visibleEnabledItems;
    if (!items.length) return;
    this.#highlight(
      moveCollectionItem({
        items,
        current: this.#activeItem,
        delta: delta < 0 ? -1 : 1,
      }),
    );
  }

  #show(reason: ComboboxOpenChangeReason, highlight: boolean): void {
    if (this.disabled || this.open || !this.#content) return;
    this.#filterItems();
    this.#pendingOpenReason = reason;
    if (highlight) {
      const selected = this.#selectedItem();
      this.#highlight(
        selected && !selected.hidden && !isItemDisabled(selected)
          ? selected
          : this.#visibleEnabledItems[0],
      );
    } else {
      this.#highlight(undefined);
    }
    this.#measureInput();
    try {
      this.#content.showPopover();
    } catch {
      this.#content.hidden = false;
      this.#content.setAttribute("data-open", "");
      this.#synchronizeOpen(true, reason);
    }
  }

  #hide(reason: ComboboxOpenChangeReason): void {
    if (!this.open || !this.#content) return;
    this.#pendingOpenReason = reason;
    try {
      this.#content.hidePopover();
    } catch {
      this.#content.hidden = true;
      this.#content.removeAttribute("data-open");
      this.#synchronizeOpen(false, reason);
    }
  }

  #synchronizeOpen(open: boolean, reason: ComboboxOpenChangeReason): void {
    this.dataset.state = open ? "open" : "closed";
    this.toggleAttribute("data-open", open);
    this.#input?.setAttribute("aria-expanded", open ? "true" : "false");
    if (this.#input) this.#input.dataset.state = open ? "open" : "closed";
    if (this.#content) this.#content.dataset.state = open ? "open" : "closed";
    for (const toggle of this.querySelectorAll<HTMLElement>(toggleSelector)) {
      toggle.dataset.state = open ? "open" : "closed";
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }
    if (open) this.#startPositioner();
    else {
      this.#stopPositioner();
      this.#highlight(undefined);
    }
    const detail: ComboboxOpenChangeDetail = { open, reason };
    this.dispatchEvent(
      new CustomEvent("ormo:combobox-open-change", {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  }

  #measureInput(): void {
    if (!this.#input || !this.#content) return;
    const inputRect = this.#input.getBoundingClientRect();
    const toggleRect =
      this.querySelector<HTMLElement>(toggleSelector)?.getBoundingClientRect();
    const width = toggleRect
      ? Math.max(inputRect.right, toggleRect.right) -
        Math.min(inputRect.left, toggleRect.left)
      : inputRect.width;
    const height = toggleRect
      ? Math.max(inputRect.height, toggleRect.height)
      : inputRect.height;
    this.#content.style.setProperty(
      "--ormo-combobox-trigger-width",
      `${width}px`,
    );
    this.#content.style.setProperty(
      "--ormo-combobox-trigger-height",
      `${height}px`,
    );
  }

  #startPositioner(): void {
    this.#stopPositioner();
    if (!this.#input || !this.#content) return;
    this.#measureInput();
    if (this.dataset.positioning !== "floating") return;
    const positioner = getFloatingPositioner();
    if (!positioner) return;
    this.#content.setAttribute("data-ormo-combobox-positioning", "floating");
    this.#positionerCleanup =
      positioner({
        root: this,
        trigger: this.#input,
        content: this.#content,
        side: parseSide(this.#content.dataset.side),
        align: parseAlign(this.#content.dataset.align),
        sideOffset: parseSideOffset(this.#content),
      }) ?? undefined;
  }

  #stopPositioner(): void {
    this.#positionerCleanup?.();
    this.#positionerCleanup = undefined;
    this.#content?.removeAttribute("data-ormo-combobox-positioning");
    this.#content?.style.removeProperty("--ormo-combobox-trigger-width");
    this.#content?.style.removeProperty("--ormo-combobox-trigger-height");
  }

  #selectItem(item: HTMLElement): void {
    if (isItemDisabled(item)) return;
    const value = itemValue(item);
    if (value === this.value || this.#setValue(value, "item", true)) {
      this.#filterItems();
      this.#hide("selection");
      this.#input?.focus();
    }
  }

  #rebuildControlOptions(): void {
    const control = this.#control;
    if (!control) return;
    const currentValue = control.value;
    const placeholder = control.querySelector<HTMLOptionElement>(
      "[data-ormo-combobox-placeholder]",
    );
    const fragment = document.createDocumentFragment();
    if (placeholder) fragment.append(placeholder);
    const groups = new Map<HTMLElement, HTMLOptGroupElement>();
    for (const item of this.#items) {
      const option = document.createElement("option");
      option.value = itemValue(item);
      option.text = itemText(item);
      option.disabled = isItemDisabled(item);
      option.defaultSelected = option.value === this.dataset.defaultValue;
      const group = item.closest<HTMLElement>(groupSelector);
      if (!group) {
        fragment.append(option);
        continue;
      }
      let optgroup = groups.get(group);
      if (!optgroup) {
        optgroup = document.createElement("optgroup");
        optgroup.label =
          group
            .querySelector<HTMLElement>(groupLabelSelector)
            ?.textContent?.trim() ?? "";
        groups.set(group, optgroup);
        fragment.append(optgroup);
      }
      optgroup.append(option);
    }
    control.replaceChildren(fragment);
    control.value = [...control.options].some(
      (option) => option.value === currentValue,
    )
      ? currentValue
      : "";
  }

  #handleInput = (): void => {
    const typedValue = this.inputValue;
    const previousInputValue = this.#lastInputValue;
    this.#lastInputValue = typedValue;
    this.#emitInputValueChange(previousInputValue, typedValue, "input");
    this.#filterItems();
    this.#show("input", false);
  };

  #handlePointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (target instanceof Element && target.closest(toggleSelector)) {
      event.preventDefault();
    }
  };

  #handleClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(toggleSelector)) {
      if (this.open) this.#hide("toggle");
      else this.#show("toggle", true);
      this.#input?.focus();
      return;
    }
    if (target.closest(clearSelector)) {
      if (this.#setValue("", "clear", true)) this.#filterItems();
      this.#input?.focus();
      return;
    }
    const item = target.closest<HTMLElement>(itemSelector);
    if (item && this.contains(item)) this.#selectItem(item);
  };

  #handleKeyDown = (event: KeyboardEvent): void => {
    if (event.target !== this.#input || this.disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!this.open) this.#show("input", true);
      else this.#moveHighlight(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Enter" && this.open && this.#activeItem) {
      event.preventDefault();
      this.#selectItem(this.#activeItem);
      return;
    }
    if (event.key === "Escape" && this.open) {
      event.preventDefault();
      this.#setInputValue(this.#selectedText(), "selection");
      this.#filterItems();
      this.#hide("escape");
      return;
    }
    if (event.key === "Tab" && this.open) {
      this.#setInputValue(this.#selectedText(), "selection");
      this.#filterItems();
      this.#hide("tab");
    }
  };

  #handlePointerMove = (event: PointerEvent): void => {
    if (!this.open) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const item = target.closest<HTMLElement>(itemSelector);
    if (item && this.contains(item) && !item.hidden && !isItemDisabled(item)) {
      this.#highlight(item);
    }
  };

  #handleToggle = (): void => {
    const open = this.open;
    const reason = this.#pendingOpenReason;
    this.#synchronizeOpen(open, reason);
    this.#pendingOpenReason = open ? "outside" : "programmatic";
    if (!open && reason === "outside") {
      this.#setInputValue(this.#selectedText(), "selection");
      this.#filterItems();
    }
  };

  #handleNativeChange = (): void => {
    this.#synchronizeValue();
    this.#filterItems();
  };
  #redirectControlFocus = (): void => this.#input?.focus();
  #handleInvalid = (): void => {
    this.#input?.setAttribute("aria-invalid", "true");
    this.#input?.focus();
  };
  #handleFormReset = (): void => {
    queueMicrotask(() => {
      this.#synchronizeValue();
      this.#filterItems();
    });
  };
  #handleBeforeSwap = (): void => {
    this.#stopPositioner();
    if (this.open) this.#hide("programmatic");
  };
}

if (!customElements.get(tagName)) {
  customElements.define(tagName, OrmoCombobox);
}
