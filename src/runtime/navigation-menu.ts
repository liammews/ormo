import { moveCollectionItem } from "./collection-navigation";
import type {
  NavigationMenuAlign,
  NavigationMenuSide,
} from "../components/navigation-menu/types";
import "./navigation-menu.css";

const rootSelector = "ormo-navigation-menu";
const itemSelector = "[data-ormo-navigation-menu-item]";
const triggerSelector = "[data-ormo-navigation-menu-trigger]";
const linkSelector = "[data-ormo-navigation-menu-link]";
const contentSelector = "[data-ormo-navigation-menu-content]";
const indicatorSelector = "[data-ormo-navigation-menu-indicator]";
let generatedId = 0;
const connectedRoots = new Set<OrmoNavigationMenu>();
const refreshPositioning = Symbol("refreshPositioning");

interface FloatingStyleSnapshot {
  bottom: string;
  left: string;
  margin: string;
  position: string;
  right: string;
  top: string;
}

function snapshotFloatingStyles(content: HTMLElement): FloatingStyleSnapshot {
  return {
    bottom: content.style.bottom,
    left: content.style.left,
    margin: content.style.margin,
    position: content.style.position,
    right: content.style.right,
    top: content.style.top,
  };
}

function restoreFloatingStyles(
  content: HTMLElement,
  snapshot: FloatingStyleSnapshot,
): void {
  const entries: Array<[keyof FloatingStyleSnapshot, string]> = [
    ["bottom", snapshot.bottom],
    ["left", snapshot.left],
    ["margin", snapshot.margin],
    ["position", snapshot.position],
    ["right", snapshot.right],
    ["top", snapshot.top],
  ];

  for (const [property, value] of entries) {
    if (value) content.style[property] = value;
    else content.style.removeProperty(property);
  }
}

export interface NavigationMenuPositionerContext {
  root: HTMLElement;
  trigger: HTMLElement;
  content: HTMLElement;
  side: NavigationMenuSide;
  align: NavigationMenuAlign;
  sideOffset: number;
}

export type NavigationMenuPositionerCleanup = () => void;
export type NavigationMenuPositioner = (
  context: NavigationMenuPositionerContext,
) => NavigationMenuPositionerCleanup | void;

const floatingPositionerKey = "__ormoNavigationMenuFloatingPositioner";
type NavigationMenuGlobalRegistry = typeof globalThis & {
  [floatingPositionerKey]?: NavigationMenuPositioner;
};

function getFloatingPositioner(): NavigationMenuPositioner | undefined {
  return (globalThis as NavigationMenuGlobalRegistry)[floatingPositionerKey];
}

export function registerNavigationMenuFloatingPositioner(
  positioner: NavigationMenuPositioner,
): void {
  (globalThis as NavigationMenuGlobalRegistry)[floatingPositionerKey] =
    positioner;
  for (const root of connectedRoots) root[refreshPositioning](true);
}

function parseSide(value: string | undefined): NavigationMenuSide {
  return value === "top" ||
    value === "right" ||
    value === "left" ||
    value === "bottom"
    ? value
    : "bottom";
}

function parseAlign(value: string | undefined): NavigationMenuAlign {
  return value === "center" || value === "end" ? value : "start";
}

function parseSideOffset(content: HTMLElement): number {
  const parsed = Number.parseFloat(
    content.style.getPropertyValue("--ormo-navigation-menu-side-offset"),
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

type OpenReason =
  | "trigger"
  | "keyboard"
  | "pointer"
  | "focus"
  | "escape"
  | "outside"
  | "programmatic";

function ownedBy(element: Element, root: HTMLElement): boolean {
  return element.closest(rootSelector) === root;
}

function parseDelay(root: HTMLElement, name: string, fallback: number): number {
  const value = Number(root.getAttribute(name));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export class OrmoNavigationMenu extends HTMLElement {
  #controller: AbortController | undefined;
  #observer: MutationObserver | undefined;
  #openTimer: ReturnType<typeof setTimeout> | undefined;
  #closeTimer: ReturnType<typeof setTimeout> | undefined;
  #value: string | null = null;
  #positionerCleanup: NavigationMenuPositionerCleanup | undefined;
  #floatingContent: HTMLElement | undefined;
  #floatingStyleSnapshot: FloatingStyleSnapshot | undefined;
  #positioningSignature = "";

  connectedCallback(): void {
    this.#controller?.abort();
    this.#controller = new AbortController();
    const { signal } = this.#controller;
    this.#value = this.getAttribute("data-value");
    connectedRoots.add(this);
    this.addEventListener("click", this.#onClick, { signal });
    this.addEventListener("keydown", this.#onKeyDown, { signal });
    this.addEventListener("pointerover", this.#onPointerOver, { signal });
    this.addEventListener("pointerout", this.#onPointerOut, { signal });
    this.ownerDocument.addEventListener("pointerdown", this.#onOutside, {
      capture: true,
      signal,
    });
    this.ownerDocument.addEventListener("focusin", this.#onOutsideFocus, {
      capture: true,
      signal,
    });
    this.#observer = new MutationObserver((records) => {
      if (records.some((record) => record.type === "childList")) {
        this.#synchronize();
      } else {
        this[refreshPositioning]();
      }
    });
    this.#observer.observe(this, {
      attributes: true,
      attributeFilter: ["data-positioning", "data-side", "data-align", "style"],
      childList: true,
      subtree: true,
    });
    this.#synchronize();
  }

  disconnectedCallback(): void {
    connectedRoots.delete(this);
    this.#controller?.abort();
    this.#observer?.disconnect();
    this.#clearTimers();
    this.#stopPositioner();
  }

  get value(): string | null {
    return this.#value;
  }

  set value(value: string | null) {
    this.#setValue(value, "programmatic");
  }

  open(value: string, reason: OpenReason = "programmatic"): boolean {
    return this.#setValue(value, reason);
  }

  close(reason: OpenReason = "programmatic"): boolean {
    return this.#setValue(null, reason);
  }

  #items(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>(itemSelector)).filter(
      (item) => ownedBy(item, this),
    );
  }

  #itemFor(element: Element | null): HTMLElement | undefined {
    const item = element?.closest<HTMLElement>(itemSelector);
    return item && ownedBy(item, this) ? item : undefined;
  }

  #trigger(item: HTMLElement): HTMLButtonElement | undefined {
    return Array.from(
      item.querySelectorAll<HTMLButtonElement>(triggerSelector),
    ).find((trigger) => ownedBy(trigger, this));
  }

  #content(item: HTMLElement): HTMLElement | undefined {
    return Array.from(item.querySelectorAll<HTMLElement>(contentSelector)).find(
      (content) => ownedBy(content, this),
    );
  }

  #setValue(value: string | null, reason: OpenReason): boolean {
    const item =
      value === null
        ? undefined
        : this.#items().find((candidate) => candidate.dataset.value === value);
    const next = item?.dataset.value ?? null;
    if (next === this.#value) return true;
    const event = new CustomEvent("ormo:open-change", {
      bubbles: true,
      cancelable: true,
      detail: { value: next, open: next !== null, reason },
    });
    if (!this.dispatchEvent(event)) return false;
    if (this.hasAttribute("data-controlled") && reason !== "programmatic") {
      return true;
    }
    this.#value = next;
    if (next === null) this.removeAttribute("data-value");
    else this.setAttribute("data-value", next);
    this.#synchronize();
    return true;
  }

  #synchronize(): void {
    for (const item of this.#items()) {
      const open = item.dataset.value === this.#value;
      item.dataset.state = open ? "open" : "closed";
      item.toggleAttribute("data-open", open);
      const trigger = this.#trigger(item);
      const content = this.#content(item);
      if (trigger && content) {
        if (!content.id) {
          generatedId += 1;
          content.id = `ormo-navigation-menu-${generatedId}`;
        }
        const anchor = `--${content.id}`;
        trigger.style.setProperty("anchor-name", anchor);
        content.style.setProperty("position-anchor", anchor);
        trigger.setAttribute("aria-controls", content.id);
        trigger.setAttribute("aria-expanded", String(open));
        trigger.dataset.state = open ? "open" : "closed";
        trigger.toggleAttribute("data-open", open);
        content.hidden = !open;
        content.toggleAttribute("inert", !open);
        content.dataset.state = open ? "open" : "closed";
        content.toggleAttribute("data-open", open);
      }
      for (const indicator of item.querySelectorAll<HTMLElement>(
        indicatorSelector,
      )) {
        if (!ownedBy(indicator, this)) continue;
        indicator.hidden = !open;
        indicator.dataset.state = open ? "open" : "closed";
        indicator.toggleAttribute("data-open", open);
      }
    }
    this[refreshPositioning](true);
  }

  [refreshPositioning](force = false): void {
    const item = this.#items().find(
      (candidate) => candidate.dataset.value === this.#value,
    );
    const trigger = item ? this.#trigger(item) : undefined;
    const content = item ? this.#content(item) : undefined;
    const signature =
      trigger && content
        ? [
            this.dataset.positioning ?? "css-anchor",
            content.id,
            content.dataset.side ?? "bottom",
            content.dataset.align ?? "start",
            parseSideOffset(content),
          ].join("|")
        : "";

    if (!force && signature === this.#positioningSignature) return;
    this.#stopPositioner();
    this.#positioningSignature = signature;
    if (trigger && content) this.#startPositioner(trigger, content);
  }

  #startPositioner(trigger: HTMLElement, content: HTMLElement): void {
    if (this.dataset.positioning !== "floating") return;
    const positioner = getFloatingPositioner();
    if (!positioner) return;
    this.#floatingContent = content;
    this.#floatingStyleSnapshot = snapshotFloatingStyles(content);
    content.setAttribute("data-ormo-navigation-menu-positioning", "floating");
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

  #stopPositioner(): void {
    this.#positionerCleanup?.();
    this.#positionerCleanup = undefined;
    const content = this.#floatingContent;
    const snapshot = this.#floatingStyleSnapshot;
    this.#floatingContent = undefined;
    this.#floatingStyleSnapshot = undefined;
    if (content && snapshot) restoreFloatingStyles(content, snapshot);
    for (const content of this.querySelectorAll<HTMLElement>(contentSelector)) {
      if (ownedBy(content, this)) {
        content.removeAttribute("data-ormo-navigation-menu-positioning");
      }
    }
  }

  #onClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    const trigger = target?.closest<HTMLButtonElement>(triggerSelector);
    if (!trigger || !ownedBy(trigger, this)) return;
    const item = this.#itemFor(trigger);
    if (!item?.dataset.value) return;
    this.#clearTimers();
    this.#setValue(
      this.#value === item.dataset.value ? null : item.dataset.value,
      "trigger",
    );
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target || !ownedBy(target, this)) return;
    const item = this.#itemFor(target);
    if (!item) return;
    const trigger = target.closest<HTMLButtonElement>(triggerSelector);
    const content = target.closest<HTMLElement>(contentSelector);
    if (event.key === "Escape" && this.#value !== null) {
      event.preventDefault();
      const openItem = this.#items().find(
        (entry) => entry.dataset.value === this.#value,
      );
      this.close("escape");
      this.#trigger(openItem ?? item)?.focus();
      return;
    }
    if (trigger && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      const value = item.dataset.value;
      if (!value || !this.open(value, "keyboard")) return;
      event.preventDefault();
      const focusable = this.#content(item)?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const list = Array.from(focusable ?? []);
      (event.key === "ArrowDown" ? list[0] : list.at(-1))?.focus();
      return;
    }
    if (
      content &&
      event.key === "ArrowUp" &&
      target ===
        content.querySelector(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
    ) {
      event.preventDefault();
      this.#trigger(item)?.focus();
      return;
    }
    const horizontal = this.dataset.orientation !== "vertical";
    const direction = getComputedStyle(this).direction;
    let delta = 0;
    if (horizontal && event.key === "ArrowRight")
      delta = direction === "rtl" ? -1 : 1;
    if (horizontal && event.key === "ArrowLeft")
      delta = direction === "rtl" ? 1 : -1;
    if (!horizontal && event.key === "ArrowDown" && !content) delta = 1;
    if (!horizontal && event.key === "ArrowUp" && !content) delta = -1;
    const controls = this.#items()
      .map(
        (entry) =>
          this.#trigger(entry) ??
          Array.from(entry.querySelectorAll<HTMLElement>(linkSelector)).find(
            (link) => ownedBy(link, this),
          ),
      )
      .filter((control): control is HTMLElement => Boolean(control));
    const current = controls.findIndex(
      (control) => control === target || control.contains(target),
    );
    let next = -1;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = controls.length - 1;
    else if (delta !== 0 && current >= 0) {
      const nextControl = moveCollectionItem({
        items: controls,
        current: controls[current],
        delta: delta as -1 | 1,
        loop: true,
      });
      next = nextControl ? controls.indexOf(nextControl) : -1;
    }
    if (next >= 0) {
      event.preventDefault();
      const nextControl = controls[next];
      nextControl?.focus();
      const nextItem = this.#itemFor(nextControl ?? null);
      if (
        this.#value !== null &&
        nextItem?.dataset.value &&
        this.#trigger(nextItem)
      ) {
        this.open(nextItem.dataset.value, "focus");
      }
    }
  };

  #onPointerOver = (event: PointerEvent): void => {
    if (
      this.getAttribute("data-open-on-hover") === "false" ||
      event.pointerType === "touch"
    )
      return;
    const item = this.#itemFor(
      event.target instanceof Element ? event.target : null,
    );
    if (!item?.dataset.value || !this.#trigger(item)) return;
    clearTimeout(this.#closeTimer);
    this.#openTimer = setTimeout(
      () => this.open(item.dataset.value!, "pointer"),
      parseDelay(this, "data-open-delay", 200),
    );
  };

  #onPointerOut = (event: PointerEvent): void => {
    if (
      this.getAttribute("data-open-on-hover") === "false" ||
      event.pointerType === "touch"
    )
      return;
    const related =
      event.relatedTarget instanceof Node ? event.relatedTarget : null;
    if (related && this.contains(related)) return;
    clearTimeout(this.#openTimer);
    this.#closeTimer = setTimeout(
      () => this.close("pointer"),
      parseDelay(this, "data-close-delay", 300),
    );
  };

  #onOutside = (event: PointerEvent): void => {
    if (event.target instanceof Node && !this.contains(event.target))
      this.close("outside");
  };

  #onOutsideFocus = (event: FocusEvent): void => {
    if (event.target instanceof Node && !this.contains(event.target))
      this.close("outside");
  };

  #clearTimers(): void {
    clearTimeout(this.#openTimer);
    clearTimeout(this.#closeTimer);
  }
}

if (!customElements.get(rootSelector)) {
  customElements.define(rootSelector, OrmoNavigationMenu);
}
