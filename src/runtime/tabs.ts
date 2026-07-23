import type {
  OrmoTabsElement,
  TabsOrientation,
} from "../components/tabs/types";

const tagName = "ormo-tabs";
const listSelector = "[data-ormo-tabs-list]";
const tabSelector = "[data-ormo-tabs-tab]";
const panelSelector = "[data-ormo-tabs-panel]";

let generatedId = 0;

interface TabsPart {
  tab: HTMLButtonElement;
  panel: HTMLElement | undefined;
  value: string;
  disabled: boolean;
}

function belongsToRoot(element: Element, root: HTMLElement): boolean {
  return element.closest(tagName) === root;
}

function isRtl(element: HTMLElement): boolean {
  return getComputedStyle(element).direction === "rtl";
}

function validateTabs(root: HTMLElement): void {
  if (!import.meta.env.DEV) {
    return;
  }

  const owns = (element: Element): boolean => belongsToRoot(element, root);
  const lists = Array.from(
    root.querySelectorAll<HTMLElement>(listSelector),
  ).filter(owns);
  const tabs = Array.from(
    root.querySelectorAll<HTMLButtonElement>(tabSelector),
  ).filter(owns);
  const panels = Array.from(
    root.querySelectorAll<HTMLElement>(panelSelector),
  ).filter(owns);

  if (lists.length === 0) {
    console.warn("[Ormo Tabs] Add Tabs.List inside Tabs.Root.", root);
  }

  for (const list of lists) {
    const labelledBy = list.getAttribute("aria-labelledby");
    const hasLabel =
      (list.hasAttribute("aria-label") &&
        list.getAttribute("aria-label")?.trim() !== "") ||
      (labelledBy !== null &&
        labelledBy
          .split(/\s+/)
          .some((id) => Boolean(id && document.getElementById(id))));

    if (!hasLabel) {
      console.warn(
        "[Ormo Tabs] Tabs.List needs an accessible name via aria-label or aria-labelledby.",
        list,
      );
    }
  }

  const tabValues = new Set<string>();
  for (const tab of tabs) {
    const value = tab.dataset.value;
    if (value === undefined || value === "") {
      console.warn("[Ormo Tabs] Tabs.Tab needs a non-empty value.", tab);
      continue;
    }
    if (tabValues.has(value)) {
      console.warn(`[Ormo Tabs] Tabs.Tab value is duplicated: ${value}`, tab);
    }
    tabValues.add(value);
  }

  const panelValues = new Set<string>();
  for (const panel of panels) {
    const value = panel.dataset.value;
    if (value === undefined || value === "") {
      console.warn("[Ormo Tabs] Tabs.Panel needs a non-empty value.", panel);
      continue;
    }
    if (panelValues.has(value)) {
      console.warn(
        `[Ormo Tabs] Tabs.Panel value is duplicated: ${value}`,
        panel,
      );
    }
    panelValues.add(value);

    if (!tabValues.has(value)) {
      console.warn(
        `[Ormo Tabs] Tabs.Panel value "${value}" has no matching Tabs.Tab.`,
        panel,
      );
    }
  }

  for (const value of tabValues) {
    if (!panelValues.has(value)) {
      const tab = tabs.find((candidate) => candidate.dataset.value === value);
      console.warn(
        `[Ormo Tabs] Tabs.Tab value "${value}" has no matching Tabs.Panel.`,
        tab ?? root,
      );
    }
  }

  for (const tab of tabs) {
    if (tab.closest(tagName) !== root) continue;
    if (!tab.closest(listSelector)) {
      console.warn("[Ormo Tabs] Tabs.Tab should be inside Tabs.List.", tab);
    }
  }
}

export class OrmoTabs extends HTMLElement implements OrmoTabsElement {
  static observedAttributes = [
    "data-disabled",
    "data-orientation",
    "data-activate-on-focus",
    "data-loop-focus",
  ];

  #controller: AbortController | undefined;
  #authoredTabDisabled = new WeakMap<HTMLButtonElement, boolean>();
  #lastAppliedTabDisabled = new WeakMap<HTMLButtonElement, boolean>();
  #initialized = false;
  #observer: MutationObserver | undefined;

  connectedCallback(): void {
    const initialValue = this.#initialized
      ? this.value
      : this.#readDefaultValue();

    this.#prepareParts();
    this.#applyValue(this.#resolveValue(initialValue));
    this.#initialized = true;
    this.#controller?.abort();
    this.#controller = new AbortController();

    this.addEventListener("click", this.#handleClick, {
      signal: this.#controller.signal,
    });
    this.addEventListener("keydown", this.#handleKeydown, {
      signal: this.#controller.signal,
    });
    this.addEventListener("focusout", this.#handleFocusOut, {
      signal: this.#controller.signal,
    });

    this.#observer?.disconnect();
    this.#observer = new MutationObserver(() => {
      const previous = this.value;
      this.#prepareParts();
      const next = this.#resolveValue(previous);
      if (next !== previous) {
        this.#requestValue(next, false);
      } else {
        this.#applyValue(next);
      }
    });
    this.#observer.observe(this, { childList: true, subtree: true });

    if (import.meta.env.DEV) {
      validateTabs(this);
    }
  }

  disconnectedCallback(): void {
    this.#controller?.abort();
    this.#controller = undefined;
    this.#observer?.disconnect();
    this.#observer = undefined;
  }

  attributeChangedCallback(): void {
    if (!this.#initialized || !this.isConnected) return;

    const previous = this.value;
    this.#prepareParts();
    const next = this.#resolveValue(previous);
    if (next !== previous) {
      this.#requestValue(next, false);
    } else {
      this.#applyValue(next);
    }
  }

  get value(): string {
    const active = this.#getParts().find(
      ({ tab }) => tab.dataset.state === "active",
    );
    return active?.value ?? "";
  }

  set value(value: string) {
    this.#applyValue(this.#resolveValue(value));
  }

  get orientation(): TabsOrientation {
    return this.dataset.orientation === "vertical" ? "vertical" : "horizontal";
  }

  set orientation(orientation: TabsOrientation) {
    this.dataset.orientation =
      orientation === "vertical" ? "vertical" : "horizontal";
  }

  get activateOnFocus(): boolean {
    return this.hasAttribute("data-activate-on-focus");
  }

  set activateOnFocus(activateOnFocus: boolean) {
    this.toggleAttribute("data-activate-on-focus", activateOnFocus);
  }

  get loopFocus(): boolean {
    return this.getAttribute("data-loop-focus") !== "false";
  }

  set loopFocus(loopFocus: boolean) {
    if (loopFocus) {
      this.removeAttribute("data-loop-focus");
    } else {
      this.setAttribute("data-loop-focus", "false");
    }
  }

  get disabled(): boolean {
    return this.hasAttribute("data-disabled");
  }

  set disabled(disabled: boolean) {
    this.toggleAttribute("data-disabled", disabled);
  }

  #getParts(): TabsPart[] {
    const panelsByValue = new Map<string, HTMLElement>();

    for (const panel of this.querySelectorAll<HTMLElement>(panelSelector)) {
      if (!belongsToRoot(panel, this)) continue;
      const value = panel.dataset.value;
      if (value !== undefined) {
        panelsByValue.set(value, panel);
      }
    }

    return Array.from(this.querySelectorAll<HTMLButtonElement>(tabSelector))
      .filter((tab) => belongsToRoot(tab, this))
      .flatMap((tab) => {
        const value = tab.dataset.value;
        if (value === undefined) {
          return [];
        }

        this.#syncAuthoredTabDisabled(tab);

        return [
          {
            tab,
            panel: panelsByValue.get(value),
            value,
            disabled:
              this.disabled ||
              tab.hasAttribute("data-item-disabled") ||
              this.#authoredTabDisabled.get(tab) === true,
          },
        ];
      });
  }

  #syncAuthoredTabDisabled(tab: HTMLButtonElement): void {
    const lastApplied = this.#lastAppliedTabDisabled.get(tab);
    const currentlyDisabled = tab.disabled;

    if (lastApplied === undefined) {
      this.#authoredTabDisabled.set(tab, currentlyDisabled);
      return;
    }

    if (currentlyDisabled !== lastApplied) {
      this.#authoredTabDisabled.set(tab, currentlyDisabled);
    }
  }

  #prepareParts(): void {
    if (!this.id) {
      generatedId += 1;
      this.id = `ormo-tabs-${generatedId}`;
    }

    const orientation = this.orientation;

    for (const list of this.querySelectorAll<HTMLElement>(listSelector)) {
      if (!belongsToRoot(list, this)) continue;
      list.dataset.orientation = orientation;
      if (orientation === "vertical") {
        list.setAttribute("aria-orientation", "vertical");
      } else {
        list.removeAttribute("aria-orientation");
      }
    }

    this.#getParts().forEach(({ tab, panel, disabled }, index) => {
      const indexValue = String(index);

      tab.id ||= `${this.id}-tab-${index + 1}`;
      if (panel) {
        panel.id ||= `${this.id}-panel-${index + 1}`;
        tab.setAttribute("aria-controls", panel.id);
        panel.setAttribute("aria-labelledby", tab.id);
        panel.dataset.orientation = orientation;
        panel.dataset.index = indexValue;
      }

      tab.disabled = disabled;
      this.#lastAppliedTabDisabled.set(tab, disabled);
      tab.toggleAttribute("data-disabled", disabled);
      tab.dataset.orientation = orientation;
      tab.dataset.index = indexValue;
      tab.setAttribute("role", "tab");
    });
  }

  #readDefaultValue(): string | undefined {
    return this.dataset.defaultValue;
  }

  #resolveValue(value: string | undefined): string {
    const parts = this.#getParts();
    if (parts.length === 0) {
      return "";
    }

    const enabled = parts.filter((part) => !part.disabled);

    if (value !== undefined && value !== "") {
      const match = parts.find(
        (part) => part.value === value && !part.disabled,
      );
      if (match) {
        return match.value;
      }
    }

    return enabled[0]?.value ?? parts[0]?.value ?? "";
  }

  #applyValue(value: string): void {
    this.#getParts().forEach(({ tab, panel, value: partValue, disabled }) => {
      const selected = partValue === value;
      const state = selected ? "active" : "inactive";

      tab.dataset.state = state;
      tab.setAttribute("aria-selected", selected ? "true" : "false");
      tab.tabIndex = selected ? 0 : -1;
      tab.toggleAttribute("data-disabled", disabled);

      if (panel) {
        panel.dataset.state = state;
        if (selected) {
          panel.removeAttribute("hidden");
          panel.tabIndex = 0;
        } else {
          panel.setAttribute("hidden", "");
          panel.removeAttribute("tabindex");
        }
      }
    });
  }

  #requestValue(value: string, cancelable = true): void {
    const normalizedValue = this.#resolveValue(value);

    if (this.value === normalizedValue) {
      return;
    }

    const event = new CustomEvent("ormo:value-change", {
      bubbles: true,
      cancelable,
      composed: true,
      detail: { value: normalizedValue },
    });

    if (this.dispatchEvent(event)) {
      this.#applyValue(normalizedValue);
    }
  }

  #focusTab(tab: HTMLButtonElement, activate: boolean): void {
    if (activate) {
      const value = tab.dataset.value;
      if (value !== undefined) {
        this.#requestValue(value);
      }
    } else {
      this.#setRovingTabIndex(tab);
    }
    tab.focus();
  }

  #setRovingTabIndex(focused: HTMLButtonElement): void {
    for (const { tab } of this.#getParts()) {
      tab.tabIndex = tab === focused ? 0 : -1;
    }
  }

  #restoreRovingTabIndex(): void {
    for (const { tab } of this.#getParts()) {
      tab.tabIndex = tab.dataset.state === "active" ? 0 : -1;
    }
  }

  #enabledParts(): TabsPart[] {
    return this.#getParts().filter((part) => !part.disabled);
  }

  #moveFocus(current: HTMLButtonElement, delta: number): void {
    const enabled = this.#enabledParts();
    if (enabled.length === 0) return;

    const currentIndex = enabled.findIndex((part) => part.tab === current);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex + delta;

    if (this.loopFocus) {
      nextIndex = (nextIndex + enabled.length) % enabled.length;
    } else {
      nextIndex = Math.max(0, Math.min(enabled.length - 1, nextIndex));
    }

    const next = enabled[nextIndex];
    if (!next || next.tab === current) return;

    this.#focusTab(next.tab, this.activateOnFocus);
  }

  #handleClick = (event: MouseEvent): void => {
    const target = event.target;
    const tab =
      target instanceof Element
        ? target.closest<HTMLButtonElement>(tabSelector)
        : null;

    if (!tab || !belongsToRoot(tab, this) || this.disabled || tab.disabled) {
      return;
    }

    const value = tab.dataset.value;
    if (value === undefined) return;

    this.#requestValue(value);
  };

  #handleFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget;
    if (next instanceof Node && this.contains(next)) {
      return;
    }
    this.#restoreRovingTabIndex();
  };

  #handleKeydown = (event: KeyboardEvent): void => {
    const target = event.target;
    const tab =
      target instanceof Element
        ? target.closest<HTMLButtonElement>(tabSelector)
        : null;

    if (!tab || !belongsToRoot(tab, this) || this.disabled || tab.disabled) {
      return;
    }

    const orientation = this.orientation;
    const rtl = isRtl(this);
    const key = event.key;

    const previousKey =
      orientation === "horizontal"
        ? rtl
          ? "ArrowRight"
          : "ArrowLeft"
        : "ArrowUp";
    const nextKey =
      orientation === "horizontal"
        ? rtl
          ? "ArrowLeft"
          : "ArrowRight"
        : "ArrowDown";

    if (key === previousKey) {
      event.preventDefault();
      this.#moveFocus(tab, -1);
      return;
    }

    if (key === nextKey) {
      event.preventDefault();
      this.#moveFocus(tab, 1);
      return;
    }

    if (key === "Home") {
      event.preventDefault();
      const first = this.#enabledParts()[0];
      if (first) {
        this.#focusTab(first.tab, this.activateOnFocus);
      }
      return;
    }

    if (key === "End") {
      event.preventDefault();
      const enabled = this.#enabledParts();
      const last = enabled[enabled.length - 1];
      if (last) {
        this.#focusTab(last.tab, this.activateOnFocus);
      }
    }

    // Enter and Space activate via the native button click path.
  };
}

if (!customElements.get(tagName)) {
  customElements.define(tagName, OrmoTabs);
}
