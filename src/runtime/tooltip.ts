import type {
  TooltipAlign,
  TooltipCloseReason,
  TooltipOpenChangeDetail,
  TooltipSide,
} from "../components/tooltip/types";
import { getTabbableElements } from "./focus";
import "./tooltip.css";

const tagName = "ormo-tooltip";
const triggerSelector = "[data-ormo-tooltip-trigger]";
const detachedTargetAttribute = "data-ormo-tooltip-for";
const contentSelector = "[data-ormo-tooltip-content]";
const startingStyleAttribute = "data-starting-style";
const endingStyleAttribute = "data-ending-style";
const defaultDelay = 700;
const defaultCloseDelay = 100;
const defaultSkipDelayDuration = 300;
const synchronizeTriggers = Symbol("synchronizeTriggers");
const notifyPointerOver = Symbol("notifyPointerOver");
const notifyPointerOut = Symbol("notifyPointerOut");
const notifyFocusIn = Symbol("notifyFocusIn");
const notifyFocusOut = Symbol("notifyFocusOut");
const notifyTriggerClick = Symbol("notifyTriggerClick");

export type TooltipPositionerCleanup = () => void;

export interface TooltipPositionerContext {
  root: HTMLElement;
  trigger: HTMLElement | undefined;
  content: HTMLElement;
  side: TooltipSide;
  align: TooltipAlign;
  sideOffset: number;
}

export type TooltipPositioner = (
  context: TooltipPositionerContext,
) => TooltipPositionerCleanup | void;

const floatingPositionerKey = "__ormoTooltipFloatingPositioner";
const skipDelayUntilKey = "__ormoTooltipSkipDelayUntil";

type TooltipGlobalRegistry = typeof globalThis & {
  [floatingPositionerKey]?: TooltipPositioner;
  [skipDelayUntilKey]?: number;
};

function getFloatingPositioner(): TooltipPositioner | undefined {
  return (globalThis as TooltipGlobalRegistry)[floatingPositionerKey];
}

function setFloatingPositioner(positioner: TooltipPositioner): void {
  (globalThis as TooltipGlobalRegistry)[floatingPositionerKey] = positioner;
}

function getSkipDelayUntil(): number {
  return (globalThis as TooltipGlobalRegistry)[skipDelayUntilKey] ?? 0;
}

function markTooltipClosedForSkipDelay(): void {
  (globalThis as TooltipGlobalRegistry)[skipDelayUntilKey] =
    Date.now() + defaultSkipDelayDuration;
}

function shouldSkipOpenDelay(): boolean {
  return Date.now() < getSkipDelayUntil();
}

/** True when `@ormo/primitives/tooltip/floating` has registered a positioner. */
export function isTooltipFloatingPositionerRegistered(): boolean {
  return Boolean(getFloatingPositioner());
}

/** Registers the Floating UI positioner used when Root sets `positioning="floating"`. */
export function registerTooltipFloatingPositioner(
  positioner: TooltipPositioner,
): void {
  setFloatingPositioner(positioner);
}

let generatedId = 0;
let supportsHintPopover: boolean | undefined;

function detectHintPopoverSupport(): boolean {
  if (supportsHintPopover !== undefined) {
    return supportsHintPopover;
  }

  if (typeof HTMLElement === "undefined") {
    supportsHintPopover = false;
    return false;
  }

  try {
    const probe = document.createElement("div");
    probe.popover = "hint";
    supportsHintPopover = probe.popover === "hint";
  } catch {
    supportsHintPopover = false;
  }

  return supportsHintPopover;
}

interface TriggerSnapshot {
  ariaDescribedBy: string | null;
  dataOpen: boolean;
  dataState: string | undefined;
}

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
    if (value) {
      content.style[property] = value;
    } else {
      content.style.removeProperty(property);
    }
  }
}

interface TooltipDocumentState {
  controller: AbortController;
  observer: MutationObserver;
  pendingSynchronization: boolean;
  roots: Set<OrmoTooltip>;
}

const documentStates = new WeakMap<Document, TooltipDocumentState>();

function hasOpenTooltip(document: Document): boolean {
  for (const root of documentStates.get(document)?.roots ?? []) {
    if (root.open) {
      return true;
    }
  }

  return false;
}

function belongsToRoot(element: Element, root: HTMLElement): boolean {
  return element.closest(tagName) === root;
}

function isTooltipOpen(content: HTMLElement): boolean {
  try {
    return content.matches(":popover-open");
  } catch {
    return content.hasAttribute("data-open");
  }
}

function parseSide(value: string | undefined): TooltipSide {
  if (
    value === "top" ||
    value === "right" ||
    value === "bottom" ||
    value === "left"
  ) {
    return value;
  }
  return "top";
}

function parseAlign(value: string | undefined): TooltipAlign {
  if (value === "start" || value === "center" || value === "end") {
    return value;
  }
  return "center";
}

function parseSideOffset(content: HTMLElement): number {
  const raw = content.style
    .getPropertyValue("--ormo-tooltip-side-offset")
    .trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNonNegativeNumber(
  value: string | null | undefined,
  fallback: number,
): number {
  if (value == null || value === "") {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function validateTooltip(root: HTMLElement): void {
  if (!import.meta.env.DEV) {
    return;
  }

  const contents = Array.from(
    root.querySelectorAll<HTMLElement>(contentSelector),
  ).filter((content) => belongsToRoot(content, root));
  const content = contents[0];

  if (!content) {
    console.warn(
      "[Ormo Tooltip] Add Tooltip.Content inside Tooltip.Root.",
      root,
    );
    return;
  }

  if (contents.length > 1) {
    console.warn(
      "[Ormo Tooltip] Tooltip.Root must contain only one Tooltip.Content.",
      root,
    );
  }

  const focusables = getTabbableElements(content, (element) =>
    belongsToRoot(element, root),
  );
  if (focusables.length > 0) {
    console.warn(
      "[Ormo Tooltip] Content must not contain focusable elements. Use Popover or a future HoverCard for interactive content.",
      root,
    );
  }

  if (
    root.getAttribute("data-positioning") === "floating" &&
    !getFloatingPositioner()
  ) {
    console.warn(
      '[Ormo Tooltip] positioning="floating" requires `import "@ormo/primitives/tooltip/floating"`. Keeping CSS Anchor Positioning until the floating entry is loaded.',
      root,
    );
  }
}

export class OrmoTooltip extends HTMLElement {
  #closeTimer: ReturnType<typeof setTimeout> | undefined;
  #controller: AbortController | undefined;
  #describedByIds = new WeakMap<HTMLElement, string>();
  #floatingStyleSnapshot: FloatingStyleSnapshot | undefined;
  #focusInside = false;
  #invoker: HTMLElement | undefined;
  #managedTriggers = new Set<HTMLElement>();
  #observer: MutationObserver | undefined;
  #openReason: "focus" | "pointer" | "programmatic" | undefined;
  #openTimer: ReturnType<typeof setTimeout> | undefined;
  #pendingReason: TooltipCloseReason = "programmatic";
  #pointerInside = false;
  #positionerCleanup: TooltipPositionerCleanup | undefined;
  #suppressOpen = false;
  #suppressToggle = false;
  #transitionFrame: number | undefined;
  #transitionTimeout: ReturnType<typeof setTimeout> | undefined;
  #transitionVersion = 0;
  #triggerSnapshots = new WeakMap<HTMLElement, TriggerSnapshot>();

  static get observedAttributes(): string[] {
    return ["data-delay", "data-close-delay", "data-disabled"];
  }

  connectedCallback(): void {
    registerTooltip(this);
    this.#prepareParts();
    this.#controller?.abort();
    this.#controller = new AbortController();

    this.addEventListener("toggle", this.#handleToggle, {
      capture: true,
      signal: this.#controller.signal,
    });
    this.addEventListener("beforetoggle", this.#handleBeforeToggle, {
      capture: true,
      signal: this.#controller.signal,
    });
    this.ownerDocument.addEventListener(
      "keydown",
      this.#handleDocumentKeyDown,
      { signal: this.#controller.signal },
    );
    this.ownerDocument.addEventListener(
      "pointerdown",
      this.#handleDocumentPointerDown,
      { signal: this.#controller.signal, capture: true },
    );
    this.ownerDocument.addEventListener(
      "astro:before-swap",
      this.#handleBeforeSwap,
      { signal: this.#controller.signal },
    );

    this.#observer?.disconnect();
    this.#observer = new MutationObserver(() => this.#prepareParts());
    this.#observer.observe(this, {
      attributeFilter: ["data-delay", "data-close-delay", "data-disabled"],
      attributes: true,
      childList: true,
      subtree: true,
    });
  }

  disconnectedCallback(): void {
    unregisterTooltip(this);
    this.#clearTimers();
    this.#controller?.abort();
    this.#controller = undefined;
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#clearTransitionSchedule();
    this.#stopPositioner();
    this.#releaseManagedTriggers();
  }

  attributeChangedCallback(): void {
    if (this.isConnected && this.disabled && this.open) {
      this.#hide("programmatic");
    }
  }

  get delay(): number {
    return parseNonNegativeNumber(
      this.getAttribute("data-delay"),
      defaultDelay,
    );
  }

  set delay(value: number) {
    this.setAttribute("data-delay", String(Math.max(0, value)));
  }

  get closeDelay(): number {
    return parseNonNegativeNumber(
      this.getAttribute("data-close-delay"),
      defaultCloseDelay,
    );
  }

  set closeDelay(value: number) {
    this.setAttribute("data-close-delay", String(Math.max(0, value)));
  }

  get disabled(): boolean {
    return this.hasAttribute("data-disabled");
  }

  set disabled(value: boolean) {
    if (value) {
      this.setAttribute("data-disabled", "");
    } else {
      this.removeAttribute("data-disabled");
    }
  }

  get open(): boolean {
    const content = this.#content;
    return content ? isTooltipOpen(content) : false;
  }

  show(): void {
    this.#show("programmatic");
  }

  hide(): void {
    this.#hide("programmatic");
  }

  [synchronizeTriggers](): void {
    const content = this.#content;
    if (content) {
      this.#synchronizeTriggers(content);
    } else {
      this.#releaseManagedTriggers();
    }
  }

  [notifyPointerOver](trigger: HTMLElement | undefined): void {
    if (this.disabled || this.#isTriggerDisabled(trigger)) {
      return;
    }

    this.#pointerInside = true;
    if (trigger) {
      this.#invoker = trigger;
    }
    this.#clearCloseTimer();
    this.#scheduleOpen("pointer");
  }

  [notifyPointerOut](relatedTarget: EventTarget | null): void {
    if (
      relatedTarget instanceof Node &&
      this.#isInsideInterestArea(relatedTarget)
    ) {
      return;
    }

    this.#pointerInside = false;
    this.#maybeClearSuppress();
    this.#scheduleClose("pointer");
  }

  [notifyFocusIn](trigger: HTMLElement): void {
    if (this.disabled || this.#isTriggerDisabled(trigger)) {
      return;
    }

    this.#focusInside = true;
    this.#invoker = trigger;
    this.#clearCloseTimer();
    this.#scheduleOpen("focus");
  }

  [notifyFocusOut](relatedTarget: EventTarget | null): void {
    if (
      relatedTarget instanceof Node &&
      this.#isInsideManagedTrigger(relatedTarget)
    ) {
      return;
    }

    this.#focusInside = false;
    this.#maybeClearSuppress();

    if (this.#pointerInside) {
      return;
    }

    this.#scheduleClose("focus");
  }

  [notifyTriggerClick](trigger: HTMLElement): void {
    if (!this.open) {
      return;
    }

    this.#invoker = trigger;
    this.#suppressOpen = true;
    this.#clearTimers();
    this.#hide("trigger");
  }

  get #content(): HTMLElement | undefined {
    return Array.from(this.querySelectorAll<HTMLElement>(contentSelector)).find(
      (content) => belongsToRoot(content, this),
    );
  }

  #isTriggerDisabled(trigger: HTMLElement | undefined): boolean {
    if (!trigger) {
      return false;
    }

    return (
      trigger.hasAttribute("disabled") ||
      trigger.getAttribute("aria-disabled") === "true"
    );
  }

  #scheduleOpen(reason: "focus" | "pointer"): void {
    if (this.disabled || this.#suppressOpen || this.open) {
      return;
    }

    this.#clearOpenTimer();
    const delay =
      reason === "focus" ||
      shouldSkipOpenDelay() ||
      hasOpenTooltip(this.ownerDocument)
        ? 0
        : this.delay;

    if (delay === 0) {
      this.#show(reason);
      return;
    }

    this.#openTimer = setTimeout(() => {
      this.#openTimer = undefined;
      this.#show(reason);
    }, delay);
  }

  #scheduleClose(reason: TooltipCloseReason): void {
    this.#clearOpenTimer();
    if (!this.open) {
      return;
    }

    this.#clearCloseTimer();
    const delay = reason === "pointer" ? this.closeDelay : 0;

    const close = (): void => {
      this.#closeTimer = undefined;
      if (this.#pointerInside || this.#focusInside) {
        return;
      }
      if (this.open) {
        this.#hide(reason);
      }
    };

    if (delay === 0) {
      close();
      return;
    }

    this.#closeTimer = setTimeout(close, delay);
  }

  #clearOpenTimer(): void {
    if (this.#openTimer !== undefined) {
      clearTimeout(this.#openTimer);
      this.#openTimer = undefined;
    }
  }

  #clearCloseTimer(): void {
    if (this.#closeTimer !== undefined) {
      clearTimeout(this.#closeTimer);
      this.#closeTimer = undefined;
    }
  }

  #clearTimers(): void {
    this.#clearOpenTimer();
    this.#clearCloseTimer();
  }

  #maybeClearSuppress(): void {
    if (!this.#pointerInside && !this.#focusInside) {
      this.#suppressOpen = false;
    }
  }

  #show(reason: "focus" | "pointer" | "programmatic"): void {
    const content = this.#content;
    if (
      !content ||
      isTooltipOpen(content) ||
      this.disabled ||
      this.#suppressOpen
    ) {
      return;
    }

    for (const root of documentStates.get(this.ownerDocument)?.roots ?? []) {
      if (root !== this && root.open) {
        root.hide();
      }
    }

    this.#invoker ??= this.#getTriggers()[0];
    this.#openReason = reason;
    this.#applyPopoverMode(content);
    this.#beginStartingStyle(content);

    try {
      const showPopover = (
        content as HTMLElement & {
          showPopover?: (options?: { source?: Element }) => void;
        }
      ).showPopover;

      if (typeof showPopover === "function") {
        if (this.#invoker) {
          showPopover.call(content, { source: this.#invoker });
        } else {
          showPopover.call(content);
        }
      } else {
        content.toggleAttribute("data-open", true);
        this.#onOpened(content, reason);
      }
    } catch {
      this.#openReason = undefined;
    }
  }

  #hide(reason: TooltipCloseReason): void {
    const content = this.#content;
    if (!content || !isTooltipOpen(content)) {
      return;
    }

    this.#pendingReason = reason;
    this.#beginEndingStyle(content);

    try {
      const hidePopover = (
        content as HTMLElement & { hidePopover?: () => void }
      ).hidePopover;
      if (typeof hidePopover === "function") {
        hidePopover.call(content);
      } else {
        content.toggleAttribute("data-open", false);
        this.#afterClose(content, reason);
      }
    } catch {
      this.#afterClose(content, reason);
    }
  }

  #onOpened(
    content: HTMLElement,
    reason: "focus" | "pointer" | "programmatic",
  ): void {
    this.#openReason = undefined;
    this.#setOpenState(true);
    this.#syncTriggerMetrics(content);
    this.#startPositioner(content);
    this.#dispatchOpenChange({
      open: true,
      reason,
    });
  }

  #afterClose(content: HTMLElement, reason: TooltipCloseReason): void {
    this.#stopPositioner();
    this.#clearTriggerMetrics(content);
    this.#setOpenState(false);
    markTooltipClosedForSkipDelay();
    this.#invoker = undefined;

    this.#dispatchOpenChange({
      open: false,
      reason,
    });
    this.#pendingReason = "programmatic";
  }

  #prepareParts(): void {
    if (!this.id) {
      generatedId += 1;
      this.id = `ormo-tooltip-${generatedId}`;
    }

    const contents = Array.from(
      this.querySelectorAll<HTMLElement>(contentSelector),
    ).filter((content) => belongsToRoot(content, this));
    const content = contents[0];

    if (!content) {
      this.#stopPositioner();
      if (import.meta.env.DEV) validateTooltip(this);
      return;
    }

    content.id ||= `${this.id}-content`;
    content.setAttribute("role", "tooltip");
    content.removeAttribute("tabindex");
    this.#applyPopoverMode(content);
    this.#applyAnchorName(content);
    this.#synchronizeTriggers(content);
    this.#setOpenState(isTooltipOpen(content));
    if (import.meta.env.DEV) validateTooltip(this);
  }

  #applyPopoverMode(content: HTMLElement): void {
    content.setAttribute(
      "popover",
      detectHintPopoverSupport() ? "hint" : "manual",
    );
  }

  #applyAnchorName(content: HTMLElement): void {
    const anchorName = `--${this.id}`;
    content.style.setProperty("--ormo-tooltip-anchor", anchorName);

    for (const trigger of this.#getTriggers()) {
      trigger.style.setProperty("anchor-name", anchorName);
    }
  }

  #syncTriggerMetrics(content: HTMLElement): void {
    const trigger = this.#invoker ?? this.#getTriggers()[0];
    if (!trigger) {
      this.#clearTriggerMetrics(content);
      return;
    }

    const rect = trigger.getBoundingClientRect();
    content.style.setProperty(
      "--ormo-tooltip-trigger-width",
      `${rect.width}px`,
    );
    content.style.setProperty(
      "--ormo-tooltip-trigger-height",
      `${rect.height}px`,
    );
  }

  #clearTriggerMetrics(content: HTMLElement): void {
    content.style.removeProperty("--ormo-tooltip-trigger-width");
    content.style.removeProperty("--ormo-tooltip-trigger-height");
  }

  #usesFloating(): boolean {
    return (
      this.getAttribute("data-positioning") === "floating" &&
      Boolean(getFloatingPositioner())
    );
  }

  #startPositioner(content: HTMLElement): void {
    this.#stopPositioner();

    const positioner = getFloatingPositioner();
    if (!this.#usesFloating() || !positioner) {
      content.removeAttribute("data-ormo-tooltip-positioning");
      return;
    }

    content.setAttribute("data-ormo-tooltip-positioning", "floating");
    this.#floatingStyleSnapshot = snapshotFloatingStyles(content);
    const trigger = this.#invoker ?? this.#getTriggers()[0];
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
    const content = this.#content;
    const snapshot = this.#floatingStyleSnapshot;
    this.#floatingStyleSnapshot = undefined;

    if (!content) {
      return;
    }

    content.removeAttribute("data-ormo-tooltip-positioning");
    content.removeAttribute("data-resolved-side");
    content.removeAttribute("data-resolved-align");

    if (snapshot) {
      restoreFloatingStyles(content, snapshot);
    }
  }

  #setOpenState(open: boolean): void {
    const state = open ? "open" : "closed";
    this.dataset.state = state;
    this.toggleAttribute("data-open", open);

    const content = this.#content;
    if (content) {
      content.dataset.state = state;
      content.toggleAttribute("data-open", open);
      this.#synchronizeDescribedBy(content, open);
    }

    for (const trigger of this.#managedTriggers) {
      trigger.dataset.state = state;
      trigger.toggleAttribute("data-open", open);
    }
  }

  #synchronizeDescribedBy(content: HTMLElement, open: boolean): void {
    for (const trigger of this.#managedTriggers) {
      if (open) {
        this.#applyDescribedBy(trigger, content.id);
      } else {
        this.#removeDescribedBy(trigger, content.id);
      }
    }
  }

  #applyDescribedBy(trigger: HTMLElement, contentId: string): void {
    const current = trigger.getAttribute("aria-describedby");
    const ids = new Set((current ?? "").split(/\s+/).filter(Boolean));
    ids.add(contentId);
    trigger.setAttribute("aria-describedby", Array.from(ids).join(" "));
    this.#describedByIds.set(trigger, contentId);
  }

  #removeDescribedBy(trigger: HTMLElement, contentId: string): void {
    const current = trigger.getAttribute("aria-describedby");
    if (!current) {
      this.#describedByIds.delete(trigger);
      return;
    }

    const next = current
      .split(/\s+/)
      .filter((id) => id && id !== contentId)
      .join(" ");

    if (next) {
      trigger.setAttribute("aria-describedby", next);
    } else {
      const snapshot = this.#triggerSnapshots.get(trigger);
      if (snapshot && snapshot.ariaDescribedBy === null) {
        trigger.removeAttribute("aria-describedby");
      } else if (snapshot?.ariaDescribedBy != null) {
        const restored = snapshot.ariaDescribedBy
          .split(/\s+/)
          .filter((id) => id && id !== contentId)
          .join(" ");
        if (restored) {
          trigger.setAttribute("aria-describedby", restored);
        } else {
          trigger.removeAttribute("aria-describedby");
        }
      } else {
        trigger.removeAttribute("aria-describedby");
      }
    }

    this.#describedByIds.delete(trigger);
  }

  #getTriggers(): HTMLElement[] {
    return Array.from(
      this.ownerDocument.querySelectorAll<HTMLElement>(triggerSelector),
    ).filter((trigger) => {
      if (trigger.hasAttribute(detachedTargetAttribute)) {
        const target = trigger.getAttribute(detachedTargetAttribute);
        return (
          Boolean(target) && this.ownerDocument.getElementById(target!) === this
        );
      }

      return belongsToRoot(trigger, this);
    });
  }

  #synchronizeTriggers(content: HTMLElement): void {
    const triggers = new Set(this.#getTriggers());

    for (const trigger of this.#managedTriggers) {
      if (!triggers.has(trigger)) {
        this.#releaseTrigger(trigger);
      }
    }

    const open = isTooltipOpen(content);
    const anchorName = `--${this.id}`;

    for (const trigger of triggers) {
      if (!this.#triggerSnapshots.has(trigger)) {
        this.#triggerSnapshots.set(trigger, {
          ariaDescribedBy: trigger.getAttribute("aria-describedby"),
          dataOpen: trigger.hasAttribute("data-open"),
          dataState: trigger.dataset.state,
        });
      }

      this.#managedTriggers.add(trigger);
      trigger.dataset.state = open ? "open" : "closed";
      trigger.toggleAttribute("data-open", open);
      trigger.style.setProperty("anchor-name", anchorName);

      if (open) {
        this.#applyDescribedBy(trigger, content.id);
      } else if (this.#describedByIds.get(trigger) === content.id) {
        this.#removeDescribedBy(trigger, content.id);
      }
    }
  }

  #releaseTrigger(trigger: HTMLElement): void {
    const snapshot = this.#triggerSnapshots.get(trigger);
    const describedId = this.#describedByIds.get(trigger);
    this.#managedTriggers.delete(trigger);
    this.#triggerSnapshots.delete(trigger);
    trigger.style.removeProperty("anchor-name");

    if (describedId) {
      this.#removeDescribedBy(trigger, describedId);
    }

    if (!snapshot) return;

    if (snapshot.dataState === undefined) {
      delete trigger.dataset.state;
    } else {
      trigger.dataset.state = snapshot.dataState;
    }
    trigger.toggleAttribute("data-open", snapshot.dataOpen);

    if (snapshot.ariaDescribedBy === null) {
      if (!this.#describedByIds.has(trigger)) {
        // already cleaned
      }
    } else if (!trigger.hasAttribute("aria-describedby")) {
      trigger.setAttribute("aria-describedby", snapshot.ariaDescribedBy);
    }
  }

  #releaseManagedTriggers(): void {
    for (const trigger of Array.from(this.#managedTriggers)) {
      this.#releaseTrigger(trigger);
    }
  }

  #isInsideManagedTrigger(node: Node): boolean {
    if (!(node instanceof Element)) {
      return false;
    }

    for (const trigger of this.#managedTriggers) {
      if (trigger === node || trigger.contains(node)) {
        return true;
      }
    }

    return false;
  }

  #isInsideInterestArea(node: Node): boolean {
    if (this.#isInsideManagedTrigger(node)) {
      return true;
    }

    const content = this.#content;
    return Boolean(
      content &&
      node instanceof Node &&
      (content === node || content.contains(node)),
    );
  }

  #clearTransitionSchedule(): void {
    this.#transitionVersion += 1;

    if (this.#transitionFrame !== undefined) {
      cancelAnimationFrame(this.#transitionFrame);
      this.#transitionFrame = undefined;
    }

    if (this.#transitionTimeout !== undefined) {
      clearTimeout(this.#transitionTimeout);
      this.#transitionTimeout = undefined;
    }
  }

  #beginStartingStyle(content: HTMLElement): void {
    this.#clearTransitionSchedule();
    const version = this.#transitionVersion;
    content.removeAttribute(endingStyleAttribute);
    content.setAttribute(startingStyleAttribute, "");

    this.#transitionFrame = requestAnimationFrame(() => {
      this.#transitionFrame = undefined;
      if (this.#transitionVersion === version && isTooltipOpen(content)) {
        content.removeAttribute(startingStyleAttribute);
      }
    });
  }

  #beginEndingStyle(content: HTMLElement): void {
    this.#clearTransitionSchedule();
    const version = this.#transitionVersion;
    content.removeAttribute(startingStyleAttribute);
    content.setAttribute(endingStyleAttribute, "");

    this.#transitionFrame = requestAnimationFrame(() => {
      this.#transitionFrame = undefined;
      if (this.#transitionVersion !== version || isTooltipOpen(content)) {
        return;
      }

      const animations =
        typeof content.getAnimations === "function"
          ? content
              .getAnimations()
              .filter((animation) => animation.playState !== "paused")
          : [];

      if (animations.length === 0) {
        content.removeAttribute(endingStyleAttribute);
        return;
      }

      const endTimes = animations
        .map((animation) =>
          Number(animation.effect?.getComputedTiming().endTime),
        )
        .filter(Number.isFinite);
      const maximumEndTime = Math.max(0, ...endTimes);
      this.#transitionTimeout = setTimeout(() => {
        if (this.#transitionVersion === version) {
          content.removeAttribute(endingStyleAttribute);
        }
      }, maximumEndTime + 50);

      void Promise.allSettled(
        animations.map((animation) => animation.finished),
      ).then(() => {
        if (this.#transitionVersion === version) {
          if (this.#transitionTimeout !== undefined) {
            clearTimeout(this.#transitionTimeout);
            this.#transitionTimeout = undefined;
          }
          content.removeAttribute(endingStyleAttribute);
        }
      });
    });
  }

  #dispatchOpenChange(detail: TooltipOpenChangeDetail): void {
    this.dispatchEvent(
      new CustomEvent("ormo:tooltip-open-change", {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  }

  #handleBeforeToggle = (event: Event): void => {
    if (event.target !== this.#content || this.#suppressToggle) {
      return;
    }

    const toggleEvent = event as ToggleEvent;
    if (toggleEvent.newState === "closed") {
      const content = this.#content;
      if (content) {
        this.#beginEndingStyle(content);
      }
    }
  };

  #handleToggle = (event: Event): void => {
    if (event.target !== this.#content || this.#suppressToggle) {
      return;
    }

    const content = this.#content;
    if (!content) {
      return;
    }

    const toggleEvent = event as ToggleEvent;
    if (toggleEvent.newState === "open") {
      this.#onOpened(content, this.#openReason ?? "programmatic");
      return;
    }

    if (toggleEvent.newState === "closed") {
      this.#afterClose(content, this.#pendingReason);
    }
  };

  #handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || event.defaultPrevented || !this.open) {
      return;
    }

    this.#pendingReason = "escape";
    event.preventDefault();
    this.#hide("escape");
  };

  #handleDocumentPointerDown = (event: PointerEvent): void => {
    if (!this.open || !(event.target instanceof Element)) {
      return;
    }

    if (this.#isInsideInterestArea(event.target)) {
      return;
    }

    // Native hint light-dismiss may close; record reason for manual mode too.
    this.#pendingReason = "pointer";
    if (!detectHintPopoverSupport()) {
      this.#hide("pointer");
    }
  };

  #handleBeforeSwap = (): void => {
    const content = this.#content;
    if (!content || !isTooltipOpen(content)) {
      return;
    }

    this.#clearTimers();
    this.#clearTransitionSchedule();
    content.removeAttribute(startingStyleAttribute);
    content.removeAttribute(endingStyleAttribute);
    this.#pendingReason = "programmatic";
    this.#suppressToggle = true;
    try {
      (content as HTMLElement & { hidePopover?: () => void }).hidePopover?.call(
        content,
      );
    } finally {
      this.#suppressToggle = false;
    }
    this.#stopPositioner();
    this.#setOpenState(false);
    this.#invoker = undefined;
  };
}

function getTriggerRoot(trigger: HTMLElement): OrmoTooltip | undefined {
  if (trigger.hasAttribute(detachedTargetAttribute)) {
    const target = trigger.getAttribute(detachedTargetAttribute);
    const root = target ? trigger.ownerDocument.getElementById(target) : null;
    return root instanceof OrmoTooltip ? root : undefined;
  }

  const root = trigger.closest(tagName);
  return root instanceof OrmoTooltip ? root : undefined;
}

function getContentRoot(content: HTMLElement): OrmoTooltip | undefined {
  const root = content.closest(tagName);
  return root instanceof OrmoTooltip ? root : undefined;
}

function registerTooltip(root: OrmoTooltip): void {
  const document = root.ownerDocument;
  let state = documentStates.get(document);

  if (!state) {
    const controller = new AbortController();
    state = {
      controller,
      observer: new MutationObserver(() => {
        const currentState = documentStates.get(document);
        if (!currentState || currentState.pendingSynchronization) return;

        currentState.pendingSynchronization = true;
        queueMicrotask(() => {
          const nextState = documentStates.get(document);
          if (!nextState) return;

          nextState.pendingSynchronization = false;
          for (const currentRoot of nextState.roots) {
            currentRoot[synchronizeTriggers]();
          }
        });
      }),
      pendingSynchronization: false,
      roots: new Set(),
    };
    documentStates.set(document, state);

    document.addEventListener(
      "pointerover",
      (event) => {
        if (!(event.target instanceof Element)) {
          return;
        }

        const trigger = event.target.closest<HTMLElement>(triggerSelector);
        if (trigger) {
          const triggerRoot = getTriggerRoot(trigger);
          if (!triggerRoot) {
            if (
              import.meta.env.DEV &&
              trigger.hasAttribute(detachedTargetAttribute)
            ) {
              console.warn(
                `[Ormo Tooltip] Trigger target "${trigger.getAttribute(detachedTargetAttribute) ?? ""}" must match a Tooltip.Root id.`,
                trigger,
              );
            }
            return;
          }
          triggerRoot[notifyPointerOver](trigger);
          return;
        }

        const content = event.target.closest<HTMLElement>(contentSelector);
        if (!content) {
          return;
        }

        const contentRoot = getContentRoot(content);
        contentRoot?.[notifyPointerOver](undefined);
      },
      { signal: controller.signal },
    );

    document.addEventListener(
      "pointerout",
      (event) => {
        if (!(event.target instanceof Element)) {
          return;
        }

        const trigger = event.target.closest<HTMLElement>(triggerSelector);
        if (trigger) {
          getTriggerRoot(trigger)?.[notifyPointerOut](event.relatedTarget);
          return;
        }

        const content = event.target.closest<HTMLElement>(contentSelector);
        if (!content) {
          return;
        }

        getContentRoot(content)?.[notifyPointerOut](event.relatedTarget);
      },
      { signal: controller.signal },
    );

    document.addEventListener(
      "focusin",
      (event) => {
        if (!(event.target instanceof Element)) {
          return;
        }

        const trigger = event.target.closest<HTMLElement>(triggerSelector);
        if (!trigger) {
          return;
        }

        const triggerRoot = getTriggerRoot(trigger);
        if (!triggerRoot) {
          return;
        }

        triggerRoot[notifyFocusIn](trigger);
      },
      { signal: controller.signal },
    );

    document.addEventListener(
      "focusout",
      (event) => {
        if (!(event.target instanceof Element)) {
          return;
        }

        const trigger = event.target.closest<HTMLElement>(triggerSelector);
        if (!trigger) {
          return;
        }

        getTriggerRoot(trigger)?.[notifyFocusOut](event.relatedTarget);
      },
      { signal: controller.signal },
    );

    document.addEventListener(
      "click",
      (event) => {
        if (event.defaultPrevented || !(event.target instanceof Element)) {
          return;
        }

        const trigger = event.target.closest<HTMLElement>(triggerSelector);
        if (!trigger) {
          return;
        }

        getTriggerRoot(trigger)?.[notifyTriggerClick](trigger);
      },
      { signal: controller.signal },
    );

    state.observer.observe(document.documentElement, {
      attributeFilter: [detachedTargetAttribute, "id"],
      attributes: true,
      childList: true,
      subtree: true,
    });
  }

  state.roots.add(root);
}

function unregisterTooltip(root: OrmoTooltip): void {
  const document = root.ownerDocument;
  const state = documentStates.get(document);
  if (!state) return;

  state.roots.delete(root);
  if (state.roots.size > 0) return;

  state.controller.abort();
  state.observer.disconnect();
  documentStates.delete(document);
}

if (typeof HTMLElement !== "undefined" && !customElements.get(tagName)) {
  customElements.define(tagName, OrmoTooltip);
}
