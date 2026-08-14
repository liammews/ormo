import type {
  DropdownMenuAlign,
  DropdownMenuOpenChangeDetail,
  DropdownMenuOpenChangeReason,
  DropdownMenuSide,
} from "../components/dropdown-menu/types";
import {
  getCollectionItems,
  moveCollectionItem,
} from "./collection-navigation";
import { Typeahead } from "./typeahead";
import "./dropdown-menu.css";

const tagName = "ormo-dropdown-menu";
const triggerSelector = "[data-ormo-dropdown-menu-trigger]";
const contentSelector = "[data-ormo-dropdown-menu-content]";
const itemSelector = "[data-ormo-dropdown-menu-item]";
const checkboxSelector = "[data-ormo-dropdown-menu-checkbox-item]";
const radioSelector = "[data-ormo-dropdown-menu-radio-item]";
const radioGroupSelector = "[data-ormo-dropdown-menu-radio-group]";
const subTriggerSelector = "[data-ormo-dropdown-menu-sub-trigger]";

export type DropdownMenuPositionerCleanup = () => void;
export interface DropdownMenuPositionerContext {
  root: HTMLElement;
  trigger: HTMLElement;
  content: HTMLElement;
  side: DropdownMenuSide;
  align: DropdownMenuAlign;
  sideOffset: number;
}
export type DropdownMenuPositioner = (
  context: DropdownMenuPositionerContext,
) => DropdownMenuPositionerCleanup | void;

const floatingKey = "__ormoDropdownMenuFloatingPositioner";
type Registry = typeof globalThis & { [floatingKey]?: DropdownMenuPositioner };
const connectedRoots = new Set<OrmoDropdownMenu>();
let generatedId = 0;

interface StyleValue {
  value: string;
  priority: string;
}

interface TriggerSnapshot {
  ariaControls: string | null;
  ariaExpanded: string | null;
  state: string | null;
  anchorName: StyleValue;
  webkitAnchorName: StyleValue;
}

interface ContentSnapshot {
  anchor: StyleValue;
  state: string | null;
}

function styleValue(element: HTMLElement, property: string): StyleValue {
  return {
    value: element.style.getPropertyValue(property),
    priority: element.style.getPropertyPriority(property),
  };
}

function restoreStyle(
  element: HTMLElement,
  property: string,
  snapshot: StyleValue,
): void {
  if (snapshot.value)
    element.style.setProperty(property, snapshot.value, snapshot.priority);
  else element.style.removeProperty(property);
}

function restoreAttribute(
  element: HTMLElement,
  name: string,
  value: string | null,
): void {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

function positioner(): DropdownMenuPositioner | undefined {
  return (globalThis as Registry)[floatingKey];
}

export function registerDropdownMenuFloatingPositioner(
  value: DropdownMenuPositioner,
): void {
  (globalThis as Registry)[floatingKey] = value;
  for (const root of connectedRoots) root.refreshPositioning();
}

function belongsToRoot(element: Element, root: HTMLElement): boolean {
  return element.closest(tagName) === root;
}

function isItemOwnedByRoot(element: Element, root: HTMLElement): boolean {
  const owner = element.closest(tagName);
  if (owner === root) return true;
  return (
    element.matches(subTriggerSelector) &&
    owner?.parentElement?.closest(tagName) === root
  );
}

function isOpen(content: HTMLElement | undefined): boolean {
  if (!content) return false;
  try {
    return content.matches(":popover-open");
  } catch {
    return content.hasAttribute("data-open");
  }
}

function showPopover(content: HTMLElement): void {
  if (typeof content.showPopover === "function") content.showPopover();
  else content.setAttribute("data-open", "");
}

function hidePopover(content: HTMLElement): void {
  if (typeof content.hidePopover === "function") content.hidePopover();
  else content.removeAttribute("data-open");
}

function parseSide(value: string | undefined): DropdownMenuSide {
  return value === "top" || value === "right" || value === "left"
    ? value
    : "bottom";
}

function parseAlign(value: string | undefined): DropdownMenuAlign {
  return value === "center" || value === "end" ? value : "start";
}

function sideOffset(content: HTMLElement): number {
  const value = Number.parseFloat(
    content.dataset.sideOffset ??
      content.style.getPropertyValue("--ormo-dropdown-menu-side-offset"),
  );
  return Number.isFinite(value) ? value : 0;
}

function direction(root: HTMLElement): "ltr" | "rtl" {
  const authored = root.closest<HTMLElement>("[dir]")?.dir;
  return authored === "rtl" || getComputedStyle(root).direction === "rtl"
    ? "rtl"
    : "ltr";
}

function topDropdownMenu(root: OrmoDropdownMenu): OrmoDropdownMenu {
  const parent = root.parentElement?.closest<OrmoDropdownMenu>(tagName);
  return parent ? topDropdownMenu(parent) : root;
}

export function validateDropdownMenu(root: HTMLElement): void {
  if (!import.meta.env.DEV) return;
  const triggers = Array.from(
    root.querySelectorAll<HTMLElement>(triggerSelector),
  ).filter((element) => belongsToRoot(element, root));
  const contents = Array.from(
    root.querySelectorAll<HTMLElement>(contentSelector),
  ).filter((element) => belongsToRoot(element, root));
  if (triggers.length !== 1)
    console.warn(
      "[Ormo Dropdown Menu] Add one Trigger inside each Root or Sub.",
      root,
    );
  if (contents.length !== 1)
    console.warn(
      "[Ormo Dropdown Menu] Add one Content inside each Root or Sub.",
      root,
    );
  if (root.dataset.positioning === "floating" && !positioner())
    console.warn(
      '[Ormo Dropdown Menu] positioning="floating" requires `import "@ormo/primitives/dropdown-menu/floating"`. Keeping CSS Anchor Positioning until it loads.',
      root,
    );
}

export class OrmoDropdownMenu extends HTMLElement {
  #contentGeneratedId = false;
  #contentSnapshot: ContentSnapshot | undefined;
  #controller: AbortController | undefined;
  #generatedId = false;
  #managedContent: HTMLElement | undefined;
  #managedTrigger: HTMLElement | undefined;
  #observer: MutationObserver | undefined;
  #pendingReason: DropdownMenuOpenChangeReason = "programmatic";
  #positionerCleanup: DropdownMenuPositionerCleanup | undefined;
  #positionedContent: HTMLElement | undefined;
  #rootStateSnapshot: string | null | undefined;
  #submenuCloseTimer: ReturnType<typeof setTimeout> | undefined;
  #triggerSnapshot: TriggerSnapshot | undefined;
  #typeahead = new Typeahead();

  static get observedAttributes(): string[] {
    return ["data-positioning", "data-disabled"];
  }

  attributeChangedCallback(): void {
    if (!this.isConnected) return;
    if (this.hasAttribute("data-disabled")) this.#close("programmatic", false);
    else if (this.open) this.refreshPositioning();
  }

  connectedCallback(): void {
    connectedRoots.add(this);
    if (!this.id) {
      generatedId += 1;
      this.id = `ormo-dropdown-menu-runtime-${generatedId}`;
      this.#generatedId = true;
    }
    this.#rootStateSnapshot ??= this.getAttribute("data-state");
    this.#controller?.abort();
    this.#controller = new AbortController();
    this.#prepare();
    validateDropdownMenu(this);
    this.addEventListener("click", this.#onClick, {
      signal: this.#controller.signal,
    });
    this.addEventListener("keydown", this.#onKeyDown, {
      signal: this.#controller.signal,
    });
    this.addEventListener("pointermove", this.#onPointerMove, {
      signal: this.#controller.signal,
    });
    this.addEventListener("toggle", this.#onToggle, {
      capture: true,
      signal: this.#controller.signal,
    });
    this.#observer = new MutationObserver(() => this.#prepare());
    this.#observer.observe(this, {
      attributeFilter: ["data-side", "data-align", "data-side-offset"],
      attributes: true,
      childList: true,
      subtree: true,
    });

    if (this.hasAttribute("data-default-open")) {
      queueMicrotask(() => {
        if (this.isConnected && !this.open) this.show();
      });
    }
  }

  disconnectedCallback(): void {
    connectedRoots.delete(this);
    this.#controller?.abort();
    this.#observer?.disconnect();
    this.#typeahead.clear();
    clearTimeout(this.#submenuCloseTimer);
    this.#stopPositioning();
    this.#releaseParts();
    restoreAttribute(this, "data-state", this.#rootStateSnapshot ?? null);
    this.#rootStateSnapshot = undefined;
    if (this.#generatedId) {
      this.removeAttribute("id");
      this.#generatedId = false;
    }
  }

  get open(): boolean {
    return isOpen(this.#content());
  }

  show(): void {
    const content = this.#content();
    if (!content || this.open || this.hasAttribute("data-disabled")) return;
    this.#pendingReason = "programmatic";
    showPopover(content);
    this.#synchronise(true);
  }

  hide(): void {
    this.#close("programmatic", true);
  }

  toggle(force?: boolean): void {
    const next = force ?? !this.open;
    if (next) this.show();
    else this.hide();
  }

  refreshPositioning(): void {
    this.#stopPositioning();
    const trigger = this.#trigger();
    const content = this.#content();
    if (!trigger || !content) return;
    if (this.dataset.positioning !== "floating") {
      content.removeAttribute("data-ormo-dropdown-menu-positioning");
      return;
    }
    const floating = positioner();
    if (!floating) return;
    content.setAttribute("data-ormo-dropdown-menu-positioning", "floating");
    this.#positionedContent = content;
    this.#positionerCleanup =
      floating({
        root: this,
        trigger,
        content,
        side: parseSide(content.dataset.side),
        align: parseAlign(content.dataset.align),
        sideOffset: sideOffset(content),
      }) ?? undefined;
  }

  #trigger(): HTMLElement | undefined {
    return Array.from(this.querySelectorAll<HTMLElement>(triggerSelector)).find(
      (element) => belongsToRoot(element, this),
    );
  }

  #content(): HTMLElement | undefined {
    return Array.from(this.querySelectorAll<HTMLElement>(contentSelector)).find(
      (element) => belongsToRoot(element, this),
    );
  }

  #items(): HTMLElement[] {
    const content = this.#content();
    return content
      ? getCollectionItems<HTMLElement>(content, itemSelector, (item) =>
          isItemOwnedByRoot(item, this),
        )
      : [];
  }

  #prepare(): void {
    const trigger = this.#trigger();
    const content = this.#content();
    if (!trigger || !content) {
      this.#stopPositioning();
      this.#releaseParts();
      return;
    }
    if (trigger !== this.#managedTrigger || content !== this.#managedContent) {
      this.#stopPositioning();
      this.#releaseParts();
      this.#managedTrigger = trigger;
      this.#managedContent = content;
      this.#triggerSnapshot = {
        ariaControls: trigger.getAttribute("aria-controls"),
        ariaExpanded: trigger.getAttribute("aria-expanded"),
        state: trigger.getAttribute("data-state"),
        anchorName: styleValue(trigger, "anchor-name"),
        webkitAnchorName: styleValue(trigger, "-webkit-anchor-name"),
      };
      this.#contentSnapshot = {
        anchor: styleValue(content, "--ormo-dropdown-menu-anchor"),
        state: content.getAttribute("data-state"),
      };
    }
    if (!content.id) {
      content.id = `${this.id}-content`;
      this.#contentGeneratedId = true;
    }
    trigger.setAttribute("aria-controls", content.id);
    const anchor = `--ormo-dropdown-menu-${this.id || content.id}`;
    trigger.style.setProperty("anchor-name", anchor);
    trigger.style.setProperty("-webkit-anchor-name", anchor);
    content.style.setProperty("--ormo-dropdown-menu-anchor", anchor);
    this.#synchroniseRadioItems();
    this.#synchronise(this.open);
    if (this.open) this.refreshPositioning();
  }

  #releaseParts(): void {
    if (this.#managedTrigger && this.#triggerSnapshot) {
      restoreAttribute(
        this.#managedTrigger,
        "aria-controls",
        this.#triggerSnapshot.ariaControls,
      );
      restoreAttribute(
        this.#managedTrigger,
        "aria-expanded",
        this.#triggerSnapshot.ariaExpanded,
      );
      restoreAttribute(
        this.#managedTrigger,
        "data-state",
        this.#triggerSnapshot.state,
      );
      restoreStyle(
        this.#managedTrigger,
        "anchor-name",
        this.#triggerSnapshot.anchorName,
      );
      restoreStyle(
        this.#managedTrigger,
        "-webkit-anchor-name",
        this.#triggerSnapshot.webkitAnchorName,
      );
    }
    if (this.#managedContent && this.#contentSnapshot) {
      restoreAttribute(
        this.#managedContent,
        "data-state",
        this.#contentSnapshot.state,
      );
      restoreStyle(
        this.#managedContent,
        "--ormo-dropdown-menu-anchor",
        this.#contentSnapshot.anchor,
      );
      if (this.#contentGeneratedId) this.#managedContent.removeAttribute("id");
    }
    this.#contentGeneratedId = false;
    this.#contentSnapshot = undefined;
    this.#managedContent = undefined;
    this.#managedTrigger = undefined;
    this.#triggerSnapshot = undefined;
  }

  #synchronise(open: boolean): void {
    this.dataset.state = open ? "open" : "closed";
    const trigger = this.#trigger();
    const content = this.#content();
    trigger?.setAttribute("aria-expanded", String(open));
    trigger?.setAttribute("data-state", open ? "open" : "closed");
    content?.setAttribute("data-state", open ? "open" : "closed");
    if (open) this.refreshPositioning();
    else this.#stopPositioning();
  }

  #synchroniseRadioItems(): void {
    for (const group of this.querySelectorAll<HTMLElement>(
      radioGroupSelector,
    )) {
      if (!belongsToRoot(group, this)) continue;
      const value = group.dataset.value;
      for (const item of group.querySelectorAll<HTMLElement>(radioSelector)) {
        if (!belongsToRoot(item, this)) continue;
        const checked = item.dataset.value === value;
        item.setAttribute("aria-checked", String(checked));
        item.dataset.state = checked ? "checked" : "unchecked";
        item.toggleAttribute("data-checked", checked);
      }
    }
  }

  #open(
    focus: "first" | "last" | "none",
    reason: DropdownMenuOpenChangeReason,
  ): void {
    const content = this.#content();
    if (!content || this.open) return;
    this.#pendingReason = reason;
    showPopover(content);
    this.#synchronise(true);
    if (focus !== "none") {
      const items = this.#items();
      (focus === "first" ? items[0] : items.at(-1))?.focus();
    }
  }

  #close(reason: DropdownMenuOpenChangeReason, restoreFocus: boolean): void {
    const content = this.#content();
    if (!content || !this.open) return;
    this.#pendingReason = reason;
    hidePopover(content);
    for (const submenu of this.querySelectorAll<OrmoDropdownMenu>(tagName)) {
      if (submenu !== this && submenu.parentElement?.closest(tagName) === this)
        submenu.#close("programmatic", false);
    }
    this.#synchronise(false);
    if (restoreFocus) this.#trigger()?.focus();
  }

  #emitOpenChange(open: boolean): void {
    this.dispatchEvent(
      new CustomEvent<DropdownMenuOpenChangeDetail>(
        "ormo:dropdown-menu-open-change",
        {
          bubbles: true,
          composed: true,
          detail: { open, reason: this.#pendingReason },
        },
      ),
    );
    this.#pendingReason = "programmatic";
  }

  #stopPositioning(): void {
    this.#positionerCleanup?.();
    this.#positionerCleanup = undefined;
    this.#positionedContent?.removeAttribute(
      "data-ormo-dropdown-menu-positioning",
    );
    this.#positionedContent = undefined;
  }

  #onToggle = (event: Event): void => {
    if (event.target !== this.#content()) return;
    const open = (event as ToggleEvent).newState === "open";
    if (!open && this.#pendingReason === "programmatic") {
      this.#pendingReason = "outside";
    }
    this.#synchronise(open);
    this.#emitOpenChange(open);
  };

  #onClick = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    const trigger = target?.closest<HTMLElement>(triggerSelector);
    if (trigger && belongsToRoot(trigger, this)) {
      if (this.open) this.#close("trigger", false);
      else this.#open("none", "trigger");
      return;
    }
    const item = target?.closest<HTMLElement>(itemSelector);
    if (!item || !isItemOwnedByRoot(item, this)) return;
    if (item.matches(subTriggerSelector)) return;
    if (item.hasAttribute("data-disabled")) {
      event.preventDefault();
      return;
    }
    const select = item.dispatchEvent(
      new CustomEvent("ormo:dropdown-menu-before-select", {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail: { item },
      }),
    );
    if (!select) return;
    if (item.matches(checkboxSelector)) {
      const checked = item.getAttribute("aria-checked") !== "true";
      item.setAttribute("aria-checked", String(checked));
      item.dataset.state = checked ? "checked" : "unchecked";
      item.toggleAttribute("data-checked", checked);
      item.dispatchEvent(
        new CustomEvent("ormo:dropdown-menu-checked-change", {
          bubbles: true,
          composed: true,
          detail: { checked, item },
        }),
      );
    } else if (item.matches(radioSelector)) {
      const group = item.closest<HTMLElement>(radioGroupSelector);
      const value = item.dataset.value;
      if (group && value !== undefined) {
        group.dataset.value = value;
        this.#synchroniseRadioItems();
        item.dispatchEvent(
          new CustomEvent("ormo:dropdown-menu-value-change", {
            bubbles: true,
            composed: true,
            detail: { value, item },
          }),
        );
      }
    }
    topDropdownMenu(this).#close("selection", true);
  };

  #onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType === "touch") return;
    const eventTarget = event.target as Element | null;
    const nestedRoot = eventTarget?.closest<OrmoDropdownMenu>(tagName);
    if (
      nestedRoot &&
      nestedRoot !== this &&
      nestedRoot.parentElement?.closest(tagName) === this
    ) {
      clearTimeout(this.#submenuCloseTimer);
      return;
    }
    const item = eventTarget?.closest<HTMLElement>(itemSelector);
    if (item && isItemOwnedByRoot(item, this)) {
      if (item.matches(subTriggerSelector)) {
        clearTimeout(this.#submenuCloseTimer);
        item.focus({ preventScroll: true });
        const submenu = item.closest<OrmoDropdownMenu>(tagName);
        for (const sibling of this.querySelectorAll<OrmoDropdownMenu>(
          tagName,
        )) {
          if (
            sibling !== submenu &&
            sibling.parentElement?.closest(tagName) === this
          )
            sibling.#close("programmatic", false);
        }
        if (submenu && submenu !== this && !submenu.open) submenu.show();
      } else {
        const openSubmenu = Array.from(
          this.querySelectorAll<OrmoDropdownMenu>(tagName),
        ).some(
          (submenu) =>
            submenu.parentElement?.closest(tagName) === this && submenu.open,
        );
        if (!openSubmenu) {
          item.focus({ preventScroll: true });
          return;
        }
        clearTimeout(this.#submenuCloseTimer);
        this.#submenuCloseTimer = setTimeout(() => {
          item.focus({ preventScroll: true });
          for (const submenu of this.querySelectorAll<OrmoDropdownMenu>(
            tagName,
          )) {
            if (submenu.parentElement?.closest(tagName) === this)
              submenu.#close("programmatic", false);
          }
        }, 120);
      }
    }
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement;
    if (target === this.#trigger()) {
      if (this.hasAttribute("data-submenu")) {
        const rootDirection = direction(this);
        const openKey = rootDirection === "rtl" ? "ArrowLeft" : "ArrowRight";
        const closeKey = rootDirection === "rtl" ? "ArrowRight" : "ArrowLeft";
        if (
          event.key === openKey ||
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          this.#open("first", "trigger");
        } else if (event.key === closeKey || event.key === "Escape") {
          event.preventDefault();
          this.#close("escape", true);
        }
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        this.#open(event.key === "ArrowDown" ? "first" : "last", "trigger");
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.#open("first", "trigger");
      }
      return;
    }
    if (!target.matches(itemSelector) || !isItemOwnedByRoot(target, this))
      return;
    const items = this.#items();
    if (event.key === "Escape") {
      event.preventDefault();
      this.#close("escape", true);
    } else if (event.key === "Tab") {
      topDropdownMenu(this).#close("tab", false);
    } else if (this.hasAttribute("data-submenu")) {
      const rootDirection = direction(this);
      const closeKey = rootDirection === "rtl" ? "ArrowRight" : "ArrowLeft";
      if (event.key === closeKey) {
        event.preventDefault();
        this.#close("escape", true);
        return;
      }
      this.#navigateItem(event, target, items);
      return;
    } else {
      this.#navigateItem(event, target, items);
    }
  };

  #navigateItem(
    event: KeyboardEvent,
    target: HTMLElement,
    items: HTMLElement[],
  ): void {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveCollectionItem({
        items,
        current: target,
        delta: event.key === "ArrowDown" ? 1 : -1,
        loop: true,
      })?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      (event.key === "Home" ? items[0] : items.at(-1))?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      target.click();
    } else if (target.matches(subTriggerSelector)) {
      const submenu = target.closest<OrmoDropdownMenu>(tagName);
      if (!submenu || submenu === this) return;
      const rootDirection = direction(this);
      const openKey = rootDirection === "rtl" ? "ArrowLeft" : "ArrowRight";
      if (event.key === openKey) {
        event.preventDefault();
        submenu.show();
        submenu
          .querySelector<HTMLElement>(
            `${contentSelector} ${itemSelector}:not(${subTriggerSelector})`,
          )
          ?.focus();
      }
    } else if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      const match = this.#typeahead.search(
        event.key,
        items,
        (item) => item.dataset.textValue || item.textContent?.trim() || "",
      );
      if (match) {
        event.preventDefault();
        match.focus();
      }
    }
  }
}

if (!customElements.get(tagName))
  customElements.define(tagName, OrmoDropdownMenu);
