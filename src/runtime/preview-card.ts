import type {
  PreviewCardAlign,
  PreviewCardOpenChangeDetail,
  PreviewCardOpenChangeReason,
  PreviewCardSide,
} from "../components/preview-card/types";
import { getTabbableElements } from "./focus";
import { PopupTransition } from "./popup-transition";
import "./preview-card.css";

const tagName = "ormo-preview-card";
const triggerSelector = "[data-ormo-preview-card-trigger]";
const contentSelector = "[data-ormo-preview-card-content]";
const roots = new Set<OrmoPreviewCard>();
const floatingKey = "__ormoPreviewCardFloatingPositioner";
let generatedId = 0;

export type PreviewCardPositionerCleanup = () => void;
export interface PreviewCardPositionerContext {
  root: HTMLElement;
  trigger: HTMLElement;
  content: HTMLElement;
  side: PreviewCardSide;
  align: PreviewCardAlign;
  sideOffset: number;
}
export type PreviewCardPositioner = (
  context: PreviewCardPositionerContext,
) => PreviewCardPositionerCleanup | void;
type Registry = typeof globalThis & { [floatingKey]?: PreviewCardPositioner };

interface StyleValue {
  value: string;
  priority: string;
}

interface TriggerSnapshot {
  anchorName: StyleValue;
  webkitAnchorName: StyleValue;
  state: string | null;
}

interface ContentSnapshot {
  anchor: StyleValue;
  ariaHidden: string | null;
  popover: string | null;
  role: string | null;
  state: string | null;
  tabindex: string | null;
}

interface FloatingStyleSnapshot {
  bottom: string;
  left: string;
  margin: string;
  position: string;
  right: string;
  top: string;
}

function getPositioner(): PreviewCardPositioner | undefined {
  return (globalThis as Registry)[floatingKey];
}

export function registerPreviewCardFloatingPositioner(
  positioner: PreviewCardPositioner,
): void {
  (globalThis as Registry)[floatingKey] = positioner;
  for (const root of roots) root.refreshPositioning(true);
}

function belongsToRoot(element: Element, root: HTMLElement): boolean {
  return element.closest(tagName) === root;
}

function ownedElements(root: HTMLElement, selector: string): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (element) => belongsToRoot(element, root),
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

function parseNumber(value: string | null, fallback: number): number {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseSide(value: string | undefined): PreviewCardSide {
  return value === "right" || value === "bottom" || value === "left"
    ? value
    : "top";
}

function parseAlign(value: string | undefined): PreviewCardAlign {
  return value === "start" || value === "end" ? value : "center";
}

function getStyleValue(element: HTMLElement, property: string): StyleValue {
  return {
    value: element.style.getPropertyValue(property),
    priority: element.style.getPropertyPriority(property),
  };
}

function restoreStyleValue(
  element: HTMLElement,
  property: string,
  snapshot: StyleValue,
): void {
  if (snapshot.value) {
    element.style.setProperty(property, snapshot.value, snapshot.priority);
  } else {
    element.style.removeProperty(property);
  }
}

function restoreAttribute(
  element: HTMLElement,
  name: string,
  value: string | null,
): void {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
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
  values: FloatingStyleSnapshot,
): void {
  for (const [name, value] of Object.entries(values)) {
    if (value) content.style.setProperty(name, value);
    else content.style.removeProperty(name);
  }
}

export function validatePreviewCard(root: HTMLElement): void {
  if (!import.meta.env.DEV) return;
  const triggers = ownedElements(root, triggerSelector);
  const contents = ownedElements(root, contentSelector);
  const trigger = triggers[0];
  const content = contents[0];

  if (!trigger) {
    console.warn(
      "[Ormo Preview Card] Add PreviewCard.Trigger inside PreviewCard.Root.",
      root,
    );
  } else if (trigger.tagName !== "A" || !trigger.hasAttribute("href")) {
    console.warn(
      "[Ormo Preview Card] Trigger must be a link with an href.",
      trigger,
    );
  }
  if (triggers.length > 1) {
    console.warn(
      "[Ormo Preview Card] PreviewCard.Root supports one PreviewCard.Trigger.",
      root,
    );
  }
  if (!content) {
    console.warn(
      "[Ormo Preview Card] Add PreviewCard.Content inside PreviewCard.Root.",
      root,
    );
  } else if (getTabbableElements(content).length > 0) {
    console.warn(
      "[Ormo Preview Card] Content must not contain focusable controls. Put essential or interactive content on the linked page.",
      content,
    );
  }
  if (contents.length > 1) {
    console.warn(
      "[Ormo Preview Card] PreviewCard.Root supports one PreviewCard.Content.",
      root,
    );
  }
  if (root.dataset.positioning === "floating" && !getPositioner()) {
    console.warn(
      '[Ormo Preview Card] positioning="floating" requires `import "@ormo/primitives/preview-card/floating"`. Keeping CSS Anchor Positioning until it loads.',
      root,
    );
  }
}

export class OrmoPreviewCard extends HTMLElement {
  #closeTimer: ReturnType<typeof setTimeout> | undefined;
  #contentSnapshot: ContentSnapshot | undefined;
  #controller: AbortController | undefined;
  #focusInside = false;
  #generatedId = false;
  #managedContent: HTMLElement | undefined;
  #managedTrigger: HTMLElement | undefined;
  #observer: MutationObserver | undefined;
  #openTimer: ReturnType<typeof setTimeout> | undefined;
  #pendingReason: PreviewCardOpenChangeReason = "programmatic";
  #pointerInside = false;
  #positionerCleanup: PreviewCardPositionerCleanup | undefined;
  #positioningSignature = "";
  #rootStateSnapshot: string | null | undefined;
  #snapshot: FloatingStyleSnapshot | undefined;
  #suppressTouchFocus = false;
  #transition = new PopupTransition();
  #triggerSnapshot: TriggerSnapshot | undefined;

  static get observedAttributes(): string[] {
    return ["data-disabled", "data-positioning"];
  }

  connectedCallback(): void {
    roots.add(this);
    if (!this.id) {
      generatedId += 1;
      this.id = `ormo-preview-card-runtime-${generatedId}`;
      this.#generatedId = true;
    }
    this.#rootStateSnapshot ??= this.getAttribute("data-state");
    this.#controller?.abort();
    this.#controller = new AbortController();

    this.addEventListener("pointerdown", this.#onPointerDown, {
      signal: this.#controller.signal,
    });
    this.addEventListener("pointerup", this.#onPointerEnd, {
      signal: this.#controller.signal,
    });
    this.addEventListener("pointercancel", this.#onPointerEnd, {
      signal: this.#controller.signal,
    });
    this.addEventListener("pointerover", this.#onPointerOver, {
      signal: this.#controller.signal,
    });
    this.addEventListener("pointerout", this.#onPointerOut, {
      signal: this.#controller.signal,
    });
    this.addEventListener("focusin", this.#onFocusIn, {
      signal: this.#controller.signal,
    });
    this.addEventListener("focusout", this.#onFocusOut, {
      signal: this.#controller.signal,
    });
    this.addEventListener("click", this.#onClick, {
      signal: this.#controller.signal,
    });
    this.addEventListener("toggle", this.#onToggle, {
      capture: true,
      signal: this.#controller.signal,
    });
    this.ownerDocument.addEventListener("keydown", this.#onKeyDown, {
      signal: this.#controller.signal,
    });
    this.ownerDocument.addEventListener(
      "astro:before-swap",
      this.#onBeforeSwap,
      { signal: this.#controller.signal },
    );

    this.#prepare();
    this.#observer?.disconnect();
    this.#observer = new MutationObserver(this.#onMutations);
    this.#observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-side", "data-align", "style"],
    });
    if (this.hasAttribute("data-default-open")) this.show();
  }

  disconnectedCallback(): void {
    roots.delete(this);
    this.#clearTimers();
    this.#controller?.abort();
    this.#controller = undefined;
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#transition.clear();
    this.#releaseParts();
    if (this.#rootStateSnapshot === null) this.removeAttribute("data-state");
    else if (this.#rootStateSnapshot !== undefined)
      this.setAttribute("data-state", this.#rootStateSnapshot);
    if (this.#generatedId) {
      this.removeAttribute("id");
      this.#generatedId = false;
    }
    this.#rootStateSnapshot = undefined;
  }

  attributeChangedCallback(): void {
    if (!this.isConnected) return;
    if (this.disabled && this.open) this.hide();
    else if (this.open) this.refreshPositioning(true);
  }

  get delay(): number {
    return parseNumber(this.getAttribute("data-delay"), 600);
  }
  set delay(value: number) {
    this.setAttribute("data-delay", String(Math.max(0, value)));
  }
  get closeDelay(): number {
    return parseNumber(this.getAttribute("data-close-delay"), 300);
  }
  set closeDelay(value: number) {
    this.setAttribute("data-close-delay", String(Math.max(0, value)));
  }
  get disabled(): boolean {
    return this.hasAttribute("data-disabled");
  }
  set disabled(value: boolean) {
    this.toggleAttribute("data-disabled", value);
  }
  get open(): boolean {
    return isOpen(this.#managedContent);
  }
  show(): void {
    this.#show("programmatic");
  }
  hide(): void {
    this.#hide("programmatic");
  }

  refreshPositioning(force = false): void {
    const trigger = this.#managedTrigger;
    const content = this.#managedContent;
    const signature = this.#getPositioningSignature();
    if (!force && signature === this.#positioningSignature) return;
    this.#stopPositioning();
    this.#positioningSignature = signature;
    const positioner = getPositioner();
    if (
      !this.open ||
      !trigger ||
      !content ||
      this.dataset.positioning !== "floating" ||
      !positioner
    )
      return;

    content.setAttribute("data-ormo-preview-card-positioning", "floating");
    this.#snapshot = snapshotFloatingStyles(content);
    this.#positionerCleanup =
      positioner({
        root: this,
        trigger,
        content,
        side: parseSide(content.dataset.side),
        align: parseAlign(content.dataset.align),
        sideOffset: parseNumber(
          content.style.getPropertyValue("--ormo-preview-card-side-offset"),
          0,
        ),
      }) ?? undefined;
  }

  #getPositioningSignature(): string {
    const content = this.#managedContent;
    return content
      ? [
          this.dataset.positioning ?? "css-anchor",
          content.dataset.side ?? "top",
          content.dataset.align ?? "center",
          content.style.getPropertyValue("--ormo-preview-card-side-offset"),
        ].join("|")
      : "";
  }

  #findTrigger(): HTMLElement | undefined {
    return ownedElements(this, triggerSelector)[0];
  }

  #findContent(): HTMLElement | undefined {
    return ownedElements(this, contentSelector)[0];
  }

  #insideArea(target: EventTarget | null): boolean {
    return (
      target instanceof Node &&
      (this.#managedTrigger?.contains(target) === true ||
        this.#managedContent?.contains(target) === true)
    );
  }

  #prepare(): void {
    const trigger = this.#findTrigger();
    const content = this.#findContent();
    if (trigger !== this.#managedTrigger || content !== this.#managedContent) {
      this.#releaseParts();
      this.#managedTrigger = trigger;
      this.#managedContent = content;
      if (trigger && content) this.#manageParts(trigger, content);
      this.#pointerInside = false;
      this.#focusInside = false;
    }

    if (!this.#managedTrigger || !this.#managedContent) {
      this.#setState(false);
      if (import.meta.env.DEV) validatePreviewCard(this);
      return;
    }

    this.#setState(this.open);
    if (this.open) this.refreshPositioning();
    if (import.meta.env.DEV) validatePreviewCard(this);
  }

  #manageParts(trigger: HTMLElement, content: HTMLElement): void {
    this.#triggerSnapshot = {
      anchorName: getStyleValue(trigger, "anchor-name"),
      webkitAnchorName: getStyleValue(trigger, "-webkit-anchor-name"),
      state: trigger.getAttribute("data-state"),
    };
    this.#contentSnapshot = {
      anchor: getStyleValue(content, "--ormo-preview-card-anchor"),
      ariaHidden: content.getAttribute("aria-hidden"),
      popover: content.getAttribute("popover"),
      role: content.getAttribute("role"),
      state: content.getAttribute("data-state"),
      tabindex: content.getAttribute("tabindex"),
    };

    content.setAttribute("aria-hidden", "true");
    content.setAttribute("popover", "manual");
    content.removeAttribute("role");
    content.removeAttribute("tabindex");
    const anchor = `--${this.id}`;
    trigger.style.setProperty("anchor-name", anchor);
    trigger.style.setProperty("-webkit-anchor-name", anchor);
    content.style.setProperty("--ormo-preview-card-anchor", anchor);
    this.#positioningSignature = this.#getPositioningSignature();
  }

  #releaseParts(): void {
    this.#stopPositioning();
    const trigger = this.#managedTrigger;
    const content = this.#managedContent;
    if (trigger && this.#triggerSnapshot) {
      restoreStyleValue(
        trigger,
        "anchor-name",
        this.#triggerSnapshot.anchorName,
      );
      restoreStyleValue(
        trigger,
        "-webkit-anchor-name",
        this.#triggerSnapshot.webkitAnchorName,
      );
      restoreAttribute(trigger, "data-state", this.#triggerSnapshot.state);
    }
    if (content && this.#contentSnapshot) {
      restoreStyleValue(
        content,
        "--ormo-preview-card-anchor",
        this.#contentSnapshot.anchor,
      );
      restoreAttribute(
        content,
        "aria-hidden",
        this.#contentSnapshot.ariaHidden,
      );
      restoreAttribute(content, "popover", this.#contentSnapshot.popover);
      restoreAttribute(content, "role", this.#contentSnapshot.role);
      restoreAttribute(content, "data-state", this.#contentSnapshot.state);
      restoreAttribute(content, "tabindex", this.#contentSnapshot.tabindex);
    }
    this.#managedTrigger = undefined;
    this.#managedContent = undefined;
    this.#triggerSnapshot = undefined;
    this.#contentSnapshot = undefined;
    this.#positioningSignature = "";
  }

  #scheduleOpen(reason: "focus" | "pointer"): void {
    if (this.disabled || this.open) return;
    this.#clearOpen();
    const delay = reason === "focus" ? 0 : this.delay;
    if (delay === 0) this.#show(reason);
    else
      this.#openTimer = setTimeout(() => {
        this.#openTimer = undefined;
        this.#show(reason);
      }, delay);
  }

  #scheduleClose(reason: "focus" | "pointer"): void {
    this.#clearOpen();
    if (!this.open) return;
    this.#clearClose();
    const close = () => {
      this.#closeTimer = undefined;
      if (!this.#pointerInside && !this.#focusInside) this.#hide(reason);
    };
    if (reason === "pointer" && this.closeDelay > 0)
      this.#closeTimer = setTimeout(close, this.closeDelay);
    else close();
  }

  #show(reason: "focus" | "pointer" | "programmatic"): void {
    const content = this.#managedContent;
    if (!content || this.open || this.disabled) return;
    for (const root of roots) {
      if (
        root !== this &&
        root.ownerDocument === this.ownerDocument &&
        root.open
      )
        root.hide();
    }
    this.#pendingReason = reason;
    this.#transition.beginOpening(content, () => this.open);
    try {
      if (typeof content.showPopover === "function") content.showPopover();
      else {
        content.setAttribute("data-open", "");
        this.#opened(reason);
      }
    } catch {
      this.#transition.clear();
      content.removeAttribute("data-starting-style");
    }
  }

  #hide(reason: PreviewCardOpenChangeReason): void {
    const content = this.#managedContent;
    if (!content || !this.open) return;
    this.#pendingReason = reason;
    this.#transition.beginClosing(content, () => this.open);
    try {
      if (typeof content.hidePopover === "function") content.hidePopover();
      else {
        content.removeAttribute("data-open");
        this.#closed(reason);
      }
    } catch {
      this.#closed(reason);
    }
  }

  #opened(reason: PreviewCardOpenChangeReason): void {
    this.#setState(true);
    this.refreshPositioning(true);
    this.#emit(true, reason);
  }

  #closed(reason: PreviewCardOpenChangeReason): void {
    this.#stopPositioning();
    this.#setState(false);
    this.#emit(false, reason);
  }

  #setState(open: boolean): void {
    const state = open ? "open" : "closed";
    this.dataset.state = state;
    this.#managedTrigger?.setAttribute("data-state", state);
    this.#managedContent?.setAttribute("data-state", state);
  }

  #emit(open: boolean, reason: PreviewCardOpenChangeReason): void {
    this.dispatchEvent(
      new CustomEvent<PreviewCardOpenChangeDetail>(
        "ormo:preview-card-open-change",
        { bubbles: true, composed: true, detail: { open, reason } },
      ),
    );
  }

  #stopPositioning(): void {
    this.#positionerCleanup?.();
    this.#positionerCleanup = undefined;
    const content = this.#managedContent;
    if (content && this.#snapshot)
      restoreFloatingStyles(content, this.#snapshot);
    this.#snapshot = undefined;
    content?.removeAttribute("data-ormo-preview-card-positioning");
    if (content) {
      delete content.dataset.resolvedSide;
      delete content.dataset.resolvedAlign;
    }
  }

  #clearOpen(): void {
    if (this.#openTimer !== undefined) clearTimeout(this.#openTimer);
    this.#openTimer = undefined;
  }

  #clearClose(): void {
    if (this.#closeTimer !== undefined) clearTimeout(this.#closeTimer);
    this.#closeTimer = undefined;
  }

  #clearTimers(): void {
    this.#clearOpen();
    this.#clearClose();
  }

  #onMutations = (records: MutationRecord[]): void => {
    if (records.some((record) => record.type === "childList")) {
      this.#prepare();
      return;
    }
    this.refreshPositioning();
  };

  #onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === "touch" && this.#insideArea(event.target)) {
      this.#suppressTouchFocus = true;
    }
  };

  #onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerType !== "touch") return;
    setTimeout(() => {
      this.#suppressTouchFocus = false;
    }, 0);
  };

  #onPointerOver = (event: PointerEvent): void => {
    if (event.pointerType === "touch" || !this.#insideArea(event.target))
      return;
    this.#pointerInside = true;
    this.#clearClose();
    this.#scheduleOpen("pointer");
  };

  #onPointerOut = (event: PointerEvent): void => {
    if (
      !this.#insideArea(event.target) ||
      this.#insideArea(event.relatedTarget)
    )
      return;
    this.#pointerInside = false;
    this.#scheduleClose("pointer");
  };

  #onFocusIn = (event: FocusEvent): void => {
    if (event.target !== this.#managedTrigger) return;
    if (this.#suppressTouchFocus) {
      this.#suppressTouchFocus = false;
      return;
    }
    this.#focusInside = true;
    this.#clearClose();
    this.#scheduleOpen("focus");
  };

  #onFocusOut = (event: FocusEvent): void => {
    if (event.target !== this.#managedTrigger) return;
    this.#focusInside = false;
    this.#suppressTouchFocus = false;
    if (!this.#pointerInside) this.#scheduleClose("focus");
  };

  #onClick = (event: MouseEvent): void => {
    if (
      (event.target as Element | null)?.closest(triggerSelector) ===
      this.#managedTrigger
    )
      this.#hide("trigger");
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && this.open) {
      event.preventDefault();
      this.#hide("escape");
    }
  };

  #onBeforeSwap = (): void => this.#hide("programmatic");

  #onToggle = (event: Event): void => {
    if (event.target !== this.#managedContent) return;
    const opened = (event as ToggleEvent).newState === "open";
    if (opened) this.#opened(this.#pendingReason);
    else this.#closed(this.#pendingReason);
    this.#pendingReason = "programmatic";
  };
}

if (!customElements.get(tagName))
  customElements.define(tagName, OrmoPreviewCard);
