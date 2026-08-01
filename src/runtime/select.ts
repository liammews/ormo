import type {
  SelectAlign,
  SelectBeforeValueChangeDetail,
  SelectChangeReason,
  SelectOpenChangeDetail,
  SelectOpenChangeReason,
  SelectSide,
  SelectValueChangeDetail,
} from "../components/select/types";
import "./select.css";

const tagName = "ormo-select";
const controlSelector = "[data-ormo-select-control]";
const triggerSelector = "[data-ormo-select-trigger]";
const contentSelector = "[data-ormo-select-content]";
const valueSelector = "[data-ormo-select-value]";
const itemSelector = "[data-ormo-select-item]";
const clearSelector = "[data-ormo-select-clear]";
const groupSelector = "[data-ormo-select-group]";
const groupLabelSelector = "[data-ormo-select-group-label]";

let generatedId = 0;

export interface SelectPositionerContext {
  root: HTMLElement;
  trigger: HTMLElement;
  content: HTMLElement;
  side: SelectSide;
  align: SelectAlign;
  sideOffset: number;
}

export type SelectPositionerCleanup = () => void;
export type SelectPositioner = (
  context: SelectPositionerContext,
) => SelectPositionerCleanup | void;

const floatingPositionerKey = "__ormoSelectFloatingPositioner";
type SelectGlobalRegistry = typeof globalThis & {
  [floatingPositionerKey]?: SelectPositioner;
};

function getFloatingPositioner(): SelectPositioner | undefined {
  return (globalThis as SelectGlobalRegistry)[floatingPositionerKey];
}

export function registerSelectFloatingPositioner(
  positioner: SelectPositioner,
): void {
  (globalThis as SelectGlobalRegistry)[floatingPositionerKey] = positioner;
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

function parseSide(value: string | undefined): SelectSide {
  return value === "top" ||
    value === "right" ||
    value === "bottom" ||
    value === "left"
    ? value
    : "bottom";
}

function parseAlign(value: string | undefined): SelectAlign {
  return value === "center" || value === "end" ? value : "start";
}

function parseSideOffset(content: HTMLElement): number {
  const parsed = Number.parseFloat(
    content.style.getPropertyValue("--ormo-select-side-offset"),
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

function itemValue(item: HTMLElement): string {
  return item.dataset.value ?? "";
}

function itemText(item: HTMLElement): string {
  return (item.dataset.textValue || item.textContent || "").trim();
}

function isItemDisabled(item: HTMLElement): boolean {
  return item.hasAttribute("data-disabled");
}

export function validateSelect(root: HTMLElement): void {
  if (!import.meta.env.DEV) return;

  const trigger = root.querySelector<HTMLElement>(triggerSelector);
  const content = root.querySelector<HTMLElement>(contentSelector);
  const items = root.querySelectorAll<HTMLElement>(itemSelector);

  if (!trigger) {
    console.warn(
      "[Ormo Select] Add Select.Trigger inside a custom Select.Root.",
      root,
    );
  } else if (
    !trigger.hasAttribute("aria-label") &&
    !trigger.hasAttribute("aria-labelledby") &&
    !root.querySelector<HTMLSelectElement>(controlSelector)?.labels?.length
  ) {
    console.warn(
      "[Ormo Select] Give Select.Trigger an accessible name or label the Select.Root control.",
      root,
    );
  }

  if (!content) {
    console.warn(
      "[Ormo Select] Add Select.Content inside a custom Select.Root.",
      root,
    );
  }

  if (items.length === 0) {
    console.warn("[Ormo Select] Add at least one Select.Item.", root);
  }

  if (
    root.getAttribute("data-positioning") === "floating" &&
    !getFloatingPositioner()
  ) {
    console.warn(
      '[Ormo Select] positioning="floating" requires `import "@ormo/primitives/select/floating"`. Keeping CSS Anchor Positioning until the floating entry is loaded.',
      root,
    );
  }

  for (const group of root.querySelectorAll<HTMLElement>(groupSelector)) {
    if (!group.querySelector(groupLabelSelector)) {
      console.warn(
        "[Ormo Select] Every Select.Group needs a Select.GroupLabel.",
        group,
      );
    }
  }

  for (const clear of root.querySelectorAll<HTMLButtonElement>(clearSelector)) {
    if (
      !clear.textContent?.trim() &&
      !clear.hasAttribute("aria-label") &&
      !clear.hasAttribute("aria-labelledby")
    ) {
      console.warn(
        "[Ormo Select] Give Select.Clear visible text or an accessible name.",
        clear,
      );
    }
  }
}

export class OrmoSelect extends HTMLElement {
  #controller: AbortController | undefined;
  #observer: MutationObserver | undefined;
  #activeItem: HTMLElement | undefined;
  #typeahead = "";
  #typeaheadTimer: ReturnType<typeof setTimeout> | undefined;
  #pendingOpenReason: SelectOpenChangeReason = "programmatic";
  #positionerCleanup: SelectPositionerCleanup | undefined;
  #authoredAttributes = new Map<Element, Map<string, string | null>>();
  #authoredValueText: string | undefined;

  connectedCallback(): void {
    this.#snapshotAttributes(this, [
      "id",
      "data-enhanced",
      "data-state",
      "data-open",
    ]);
    this.#controller?.abort();
    this.#controller = new AbortController();
    this.#prepare();

    this.addEventListener("click", this.#handleClick, {
      signal: this.#controller.signal,
    });
    this.addEventListener("keydown", this.#handleKeyDown, {
      signal: this.#controller.signal,
    });
    this.addEventListener("pointermove", this.#handlePointerMove, {
      signal: this.#controller.signal,
    });
    this.#content?.addEventListener("toggle", this.#handleToggle, {
      signal: this.#controller.signal,
    });
    this.#control?.addEventListener("change", this.#handleNativeChange, {
      signal: this.#controller.signal,
    });
    this.#control?.addEventListener("input", this.#handleNativeInput, {
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
              record.target.closest(valueSelector) ||
              record.target.closest(controlSelector),
            ),
        )
      ) {
        return;
      }
      this.#rebuildControlOptions();
      this.#prepare();
    });
    this.#observer.observe(this, {
      childList: true,
      subtree: true,
    });
  }

  disconnectedCallback(): void {
    this.#controller?.abort();
    this.#controller = undefined;
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#stopPositioner();
    if (this.#typeaheadTimer) clearTimeout(this.#typeaheadTimer);
    this.#restoreAuthoredState();
  }

  get value(): string {
    return this.#control?.value ?? "";
  }

  set value(value: string) {
    this.#setValue(String(value), "programmatic", false);
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
    this.#show("programmatic");
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

  get #trigger(): HTMLButtonElement | undefined {
    return this.querySelector<HTMLButtonElement>(triggerSelector) ?? undefined;
  }

  get #content(): HTMLElement | undefined {
    return this.querySelector<HTMLElement>(contentSelector) ?? undefined;
  }

  get #items(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>(itemSelector));
  }

  get #enabledItems(): HTMLElement[] {
    return this.#items.filter((item) => !isItemDisabled(item));
  }

  #prepare(): void {
    const control = this.#control;
    const trigger = this.#trigger;
    const content = this.#content;
    if (!control || !trigger || !content) {
      this.removeAttribute("data-enhanced");
      validateSelect(this);
      return;
    }

    this.#snapshotAttributes(control, [
      "id",
      "disabled",
      "tabindex",
      "aria-hidden",
    ]);
    this.#snapshotAttributes(trigger, [
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
      "data-open",
      "data-placeholder",
      "style",
    ]);
    this.#snapshotAttributes(content, [
      "id",
      "aria-labelledby",
      "data-disabled",
      "data-state",
      "data-open",
      "data-ormo-select-positioning",
      "data-resolved-side",
      "data-resolved-align",
      "style",
    ]);
    for (const label of Array.from(control.labels ?? [])) {
      this.#snapshotAttributes(label, ["id"]);
    }
    for (const item of this.#items) {
      this.#snapshotAttributes(item, ["id", "aria-selected", "data-selected"]);
    }
    for (const clear of this.querySelectorAll(clearSelector)) {
      this.#snapshotAttributes(clear, ["disabled", "data-disabled"]);
    }
    const valuePart = this.querySelector<HTMLElement>(valueSelector);
    if (valuePart) {
      this.#snapshotAttributes(valuePart, ["data-placeholder"]);
      this.#authoredValueText ??= valuePart.textContent ?? "";
    }

    const baseId = this.id || `ormo-select-${++generatedId}`;
    if (!this.id) this.id = baseId;
    if (!control.id) control.id = `${baseId}-control`;
    if (!trigger.id) trigger.id = `${baseId}-trigger`;
    if (!content.id) content.id = `${baseId}-content`;

    trigger.setAttribute("aria-controls", content.id);
    trigger.setAttribute("aria-expanded", this.open ? "true" : "false");
    trigger.setAttribute("aria-required", control.required ? "true" : "false");
    content.setAttribute("aria-labelledby", trigger.id);

    const labels = Array.from(control.labels ?? []);
    for (const [index, label] of labels.entries()) {
      if (!label.id) label.id = `${baseId}-label-${index + 1}`;
    }
    if (
      labels.length &&
      !trigger.hasAttribute("aria-label") &&
      !trigger.hasAttribute("aria-labelledby")
    ) {
      trigger.setAttribute(
        "aria-labelledby",
        labels.map((label) => label.id).join(" "),
      );
    }

    const disabled = this.disabled;
    control.disabled = disabled;
    trigger.disabled = disabled;
    trigger.toggleAttribute("data-disabled", disabled);
    content.toggleAttribute("data-disabled", disabled);

    const anchorName = `--${baseId}-anchor`;
    trigger.style.setProperty("anchor-name", anchorName);
    content.style.setProperty("--ormo-select-anchor", anchorName);

    for (const [index, item] of this.#items.entries()) {
      if (!item.id) item.id = `${baseId}-item-${index + 1}`;
    }

    control.tabIndex = -1;
    control.setAttribute("aria-hidden", "true");
    this.setAttribute("data-enhanced", "");
    this.#synchronizeValue();
    validateSelect(this);
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
    const valuePart = this.querySelector<HTMLElement>(valueSelector);
    if (valuePart && this.#authoredValueText !== undefined) {
      valuePart.textContent = this.#authoredValueText;
    }
    this.#authoredAttributes.clear();
    this.#authoredValueText = undefined;
  }

  #rebuildControlOptions(): void {
    const control = this.#control;
    if (!control) return;
    const currentValue = control.value;
    const placeholder = control.querySelector<HTMLOptionElement>(
      "[data-ormo-select-placeholder]",
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

  #synchronizeValue(): void {
    const value = this.value;
    const selected = this.#items.find((item) => itemValue(item) === value);
    const valuePart = this.querySelector<HTMLElement>(valueSelector);
    const placeholder =
      this.#control?.options[0]?.value === ""
        ? this.#control.options[0]?.text
        : "";

    for (const item of this.#items) {
      const isSelected = itemValue(item) === value;
      item.setAttribute("aria-selected", isSelected ? "true" : "false");
      item.toggleAttribute("data-selected", isSelected);
    }

    if (valuePart) {
      const nextText = selected ? itemText(selected) : placeholder;
      if (valuePart.textContent !== nextText) valuePart.textContent = nextText;
      valuePart.toggleAttribute("data-placeholder", !selected);
    }

    const trigger = this.#trigger;
    trigger?.toggleAttribute("data-placeholder", !selected);
    if (this.#control?.validity.valid) trigger?.removeAttribute("aria-invalid");

    for (const clear of this.querySelectorAll<HTMLButtonElement>(
      clearSelector,
    )) {
      clear.disabled =
        clear.hasAttribute("data-item-disabled") ||
        this.disabled ||
        value === "";
      clear.hidden = value === "";
      clear.toggleAttribute("data-disabled", clear.disabled);
    }
  }

  #setValue(
    nextValue: string,
    reason: SelectChangeReason,
    emitNativeEvents: boolean,
  ): boolean {
    const control = this.#control;
    if (!control || control.value === nextValue) return false;
    if (![...control.options].some((option) => option.value === nextValue)) {
      nextValue = "";
    }

    const previousValue = control.value;
    if (reason !== "programmatic") {
      const detail: SelectBeforeValueChangeDetail = {
        value: nextValue,
        previousValue,
        reason,
      };
      const allowed = this.dispatchEvent(
        new CustomEvent("ormo:select-before-value-change", {
          bubbles: true,
          composed: true,
          cancelable: true,
          detail,
        }),
      );
      if (!allowed) return false;
    }

    control.value = nextValue;
    this.#synchronizeValue();

    if (emitNativeEvents) {
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const detail: SelectValueChangeDetail = {
      value: nextValue,
      previousValue,
      reason,
    };
    this.dispatchEvent(
      new CustomEvent("ormo:select-value-change", {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
    return true;
  }

  #highlight(item: HTMLElement | undefined): void {
    for (const candidate of this.#items) {
      candidate.toggleAttribute("data-highlighted", candidate === item);
    }
    this.#activeItem = item;
    const trigger = this.#trigger;
    if (item) {
      trigger?.setAttribute("aria-activedescendant", item.id);
      item.scrollIntoView?.({ block: "nearest" });
    } else {
      trigger?.removeAttribute("aria-activedescendant");
    }
  }

  #moveHighlight(delta: number): void {
    const items = this.#enabledItems;
    if (!items.length) return;
    const current = this.#activeItem ? items.indexOf(this.#activeItem) : -1;
    const index =
      current < 0
        ? delta > 0
          ? 0
          : items.length - 1
        : Math.max(0, Math.min(items.length - 1, current + delta));
    this.#highlight(items[index]);
  }

  #show(reason: SelectOpenChangeReason): void {
    if (this.disabled || this.open) return;
    const content = this.#content;
    if (!content) return;
    this.#pendingOpenReason = reason;
    const selected =
      this.#items.find((item) => itemValue(item) === this.value) ??
      this.#enabledItems[0];
    this.#highlight(
      selected && !isItemDisabled(selected) ? selected : undefined,
    );
    this.#measureTrigger();
    try {
      content.showPopover();
    } catch {
      content.hidden = false;
      content.setAttribute("data-open", "");
      this.#synchronizeOpen(true, reason);
    }
  }

  #hide(reason: SelectOpenChangeReason): void {
    if (!this.open) return;
    const content = this.#content;
    if (!content) return;
    this.#pendingOpenReason = reason;
    try {
      content.hidePopover();
    } catch {
      content.hidden = true;
      content.removeAttribute("data-open");
      this.#synchronizeOpen(false, reason);
    }
  }

  #synchronizeOpen(open: boolean, reason: SelectOpenChangeReason): void {
    this.dataset.state = open ? "open" : "closed";
    this.toggleAttribute("data-open", open);
    this.#trigger?.setAttribute("aria-expanded", open ? "true" : "false");
    this.#trigger!.dataset.state = open ? "open" : "closed";
    if (this.#content) this.#content.dataset.state = open ? "open" : "closed";

    if (open) this.#startPositioner();
    else {
      this.#stopPositioner();
      this.#highlight(undefined);
    }

    const detail: SelectOpenChangeDetail = { open, reason };
    this.dispatchEvent(
      new CustomEvent("ormo:select-open-change", {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  }

  #startPositioner(): void {
    this.#stopPositioner();
    const trigger = this.#trigger;
    const content = this.#content;
    if (!trigger || !content) return;

    this.#measureTrigger();

    if (this.dataset.positioning !== "floating") return;
    const positioner = getFloatingPositioner();
    if (!positioner) return;
    content.setAttribute("data-ormo-select-positioning", "floating");
    this.#positionerCleanup =
      positioner({
        root: this,
        trigger,
        content,
        side: parseSide(content.dataset.side),
        align: parseAlign(content.dataset.align),
        sideOffset: parseSideOffset(content),
      }) ?? undefined;
  }

  #measureTrigger(): void {
    const trigger = this.#trigger;
    const content = this.#content;
    if (!trigger || !content) return;

    const rect = trigger.getBoundingClientRect();
    content.style.setProperty("--ormo-select-trigger-width", `${rect.width}px`);
    content.style.setProperty(
      "--ormo-select-trigger-height",
      `${rect.height}px`,
    );
  }

  #stopPositioner(): void {
    this.#positionerCleanup?.();
    this.#positionerCleanup = undefined;
    const content = this.#content;
    content?.removeAttribute("data-ormo-select-positioning");
    content?.style.removeProperty("--ormo-select-trigger-width");
    content?.style.removeProperty("--ormo-select-trigger-height");
  }

  #selectItem(item: HTMLElement): void {
    if (isItemDisabled(item)) return;
    const value = itemValue(item);
    if (value === this.value || this.#setValue(value, "item", true)) {
      this.#hide("selection");
      this.#trigger?.focus();
    }
  }

  #typeaheadSearch(character: string): void {
    if (this.#typeaheadTimer) clearTimeout(this.#typeaheadTimer);
    this.#typeahead += character.toLocaleLowerCase();
    this.#typeaheadTimer = setTimeout(() => {
      this.#typeahead = "";
    }, 700);

    const match = this.#enabledItems.find((item) =>
      itemText(item).toLocaleLowerCase().startsWith(this.#typeahead),
    );
    if (!match) return;
    if (this.open) this.#highlight(match);
    else this.#setValue(itemValue(match), "item", true);
  }

  #handleClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(triggerSelector)) {
      this.toggle();
      return;
    }
    if (target.closest(clearSelector)) {
      this.#setValue("", "clear", true);
      this.#trigger?.focus();
      return;
    }
    const item = target.closest<HTMLElement>(itemSelector);
    if (item && this.contains(item)) this.#selectItem(item);
  };

  #handleKeyDown = (event: KeyboardEvent): void => {
    if (event.target !== this.#trigger || this.disabled) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!this.open) this.#show("trigger");
      else this.#moveHighlight(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Home" && this.open) {
      event.preventDefault();
      this.#highlight(this.#enabledItems[0]);
      return;
    }
    if (event.key === "End" && this.open) {
      event.preventDefault();
      this.#highlight(this.#enabledItems.at(-1));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!this.open) this.#show("trigger");
      else if (this.#activeItem) this.#selectItem(this.#activeItem);
      return;
    }
    if (event.key === "Escape" && this.open) {
      event.preventDefault();
      this.#hide("escape");
      return;
    }
    if (event.key === "Tab" && this.open) {
      this.#hide("tab");
      return;
    }
    if (
      event.key.length === 1 &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      this.#typeaheadSearch(event.key);
    }
  };

  #handleToggle = (): void => {
    const open = this.open;
    const reason = open ? this.#pendingOpenReason : this.#pendingOpenReason;
    this.#synchronizeOpen(open, reason);
    this.#pendingOpenReason = open ? "outside" : "programmatic";
    if (!open && reason !== "selection" && reason !== "tab") {
      this.#trigger?.focus();
    }
  };

  #handlePointerMove = (event: PointerEvent): void => {
    if (!this.open) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const item = target.closest<HTMLElement>(itemSelector);
    if (item && this.contains(item) && !isItemDisabled(item)) {
      this.#highlight(item);
    }
  };

  #handleNativeInput = (): void => this.#synchronizeValue();

  #handleNativeChange = (): void => {
    this.#synchronizeValue();
  };

  #redirectControlFocus = (): void => {
    if (this.hasAttribute("data-enhanced")) this.#trigger?.focus();
  };

  #handleInvalid = (): void => {
    this.#trigger?.setAttribute("aria-invalid", "true");
  };

  #handleFormReset = (): void => {
    queueMicrotask(() => this.#synchronizeValue());
  };

  #handleBeforeSwap = (): void => {
    this.#stopPositioner();
    if (this.open) this.#hide("programmatic");
  };
}

if (!customElements.get(tagName)) {
  customElements.define(tagName, OrmoSelect);
}
