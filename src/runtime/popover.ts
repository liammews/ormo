import type {
  PopoverAlign,
  PopoverCloseReason,
  PopoverOpenChangeDetail,
  PopoverSide,
} from "../components/popover/types";
import { getTabbableElements, isProgrammaticallyFocusable } from "./focus";
import "./popover.css";

const tagName = "ormo-popover";
const triggerSelector = "[data-ormo-popover-trigger]";
const detachedTargetAttribute = "data-ormo-popover-for";
const contentSelector = "[data-ormo-popover-content]";
const titleSelector = "[data-ormo-popover-title]";
const descriptionSelector = "[data-ormo-popover-description]";
const closeSelector = "[data-ormo-popover-close]";
const startingStyleAttribute = "data-starting-style";
const endingStyleAttribute = "data-ending-style";
const openFromTrigger = Symbol("openFromTrigger");
const synchronizeTriggers = Symbol("synchronizeTriggers");

export type PopoverPositionerCleanup = () => void;

export interface PopoverPositionerContext {
  root: HTMLElement;
  trigger: HTMLElement | undefined;
  content: HTMLElement;
  side: PopoverSide;
  align: PopoverAlign;
  sideOffset: number;
}

export type PopoverPositioner = (
  context: PopoverPositionerContext,
) => PopoverPositionerCleanup | void;

const floatingPositionerKey = "__ormoPopoverFloatingPositioner";

type PopoverGlobalRegistry = typeof globalThis & {
  [floatingPositionerKey]?: PopoverPositioner;
};

function getFloatingPositioner(): PopoverPositioner | undefined {
  return (globalThis as PopoverGlobalRegistry)[floatingPositionerKey];
}

function setFloatingPositioner(positioner: PopoverPositioner): void {
  (globalThis as PopoverGlobalRegistry)[floatingPositionerKey] = positioner;
}

/** True when `@ormo/primitives/popover/floating` has registered a positioner. */
export function isPopoverFloatingPositionerRegistered(): boolean {
  return Boolean(getFloatingPositioner());
}

let generatedId = 0;

interface TriggerSnapshot {
  ariaControls: string | null;
  ariaExpanded: string | null;
  ariaHasPopup: string | null;
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

interface PopoverDocumentState {
  controller: AbortController;
  observer: MutationObserver;
  pendingSynchronization: boolean;
  roots: Set<OrmoPopover>;
}

const documentStates = new WeakMap<Document, PopoverDocumentState>();

function belongsToRoot(element: Element, root: HTMLElement): boolean {
  return element.closest(tagName) === root;
}

function isPopoverOpen(content: HTMLElement): boolean {
  try {
    return content.matches(":popover-open");
  } catch {
    return content.hasAttribute("data-open");
  }
}

function parseSide(value: string | undefined): PopoverSide {
  if (
    value === "top" ||
    value === "right" ||
    value === "bottom" ||
    value === "left"
  ) {
    return value;
  }
  return "bottom";
}

function parseAlign(value: string | undefined): PopoverAlign {
  if (value === "start" || value === "center" || value === "end") {
    return value;
  }
  return "center";
}

function parseSideOffset(content: HTMLElement): number {
  const raw = content.style
    .getPropertyValue("--ormo-popover-side-offset")
    .trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Registers the Floating UI positioner used when Root sets `positioning="floating"`. */
export function registerPopoverFloatingPositioner(
  positioner: PopoverPositioner,
): void {
  setFloatingPositioner(positioner);
}

export function validatePopover(root: HTMLElement): void {
  if (!import.meta.env.DEV) {
    return;
  }

  const contents = Array.from(
    root.querySelectorAll<HTMLElement>(contentSelector),
  ).filter((content) => belongsToRoot(content, root));
  const content = contents[0];

  if (!content) {
    console.warn(
      "[Ormo Popover] Add Popover.Content inside Popover.Root.",
      root,
    );
    return;
  }

  if (contents.length > 1) {
    console.warn(
      "[Ormo Popover] Popover.Root must contain only one Popover.Content.",
      root,
    );
  }

  const title = Array.from(
    content.querySelectorAll<HTMLElement>(titleSelector),
  ).find((element) => belongsToRoot(element, root));

  if (
    !title &&
    !content.hasAttribute("aria-label") &&
    !content.hasAttribute("aria-labelledby")
  ) {
    console.warn(
      "[Ormo Popover] Add Popover.Title or an aria-label to Popover.Content.",
      root,
    );
  }

  const closeControls = Array.from(
    content.querySelectorAll<HTMLElement>(closeSelector),
  ).filter((element) => belongsToRoot(element, root));

  if (closeControls.length === 0) {
    console.warn(
      "[Ormo Popover] Add Popover.Close so keyboard and touch screen reader users can close the popover.",
      root,
    );
  }

  if (
    root.getAttribute("data-positioning") === "floating" &&
    !getFloatingPositioner()
  ) {
    console.warn(
      '[Ormo Popover] positioning="floating" requires `import "@ormo/primitives/popover/floating"`. Keeping CSS Anchor Positioning until the floating entry is loaded.',
      root,
    );
  }
}

export class OrmoPopover extends HTMLElement {
  #controller: AbortController | undefined;
  #generatedDescriptions = new WeakMap<HTMLElement, string>();
  #generatedLabels = new WeakMap<HTMLElement, string>();
  #finalFocus: HTMLElement | null = null;
  #invoker: HTMLElement | undefined;
  #managedTriggers = new Set<HTMLElement>();
  #observer: MutationObserver | undefined;
  #openReason: "programmatic" | "trigger" | undefined;
  #pendingReason: PopoverCloseReason | "trigger" = "programmatic";
  #floatingStyleSnapshot: FloatingStyleSnapshot | undefined;
  #positionerCleanup: PopoverPositionerCleanup | undefined;
  #returnValue = "";
  #suppressToggle = false;
  #transitionFrame: number | undefined;
  #transitionTimeout: ReturnType<typeof setTimeout> | undefined;
  #transitionVersion = 0;
  #triggerSnapshots = new WeakMap<HTMLElement, TriggerSnapshot>();

  connectedCallback(): void {
    registerPopover(this);
    this.#prepareParts();
    this.#controller?.abort();
    this.#controller = new AbortController();

    this.addEventListener("click", this.#handleClick, {
      signal: this.#controller.signal,
    });
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
    this.#observer.observe(this, { childList: true, subtree: true });
  }

  disconnectedCallback(): void {
    unregisterPopover(this);
    this.#controller?.abort();
    this.#controller = undefined;
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#clearTransitionSchedule();
    this.#stopPositioner();
    this.#releaseManagedTriggers();
  }

  get finalFocus(): HTMLElement | null {
    return this.#finalFocus;
  }

  set finalFocus(value: HTMLElement | null) {
    this.#finalFocus = value;
  }

  get open(): boolean {
    const content = this.#content;
    return content ? isPopoverOpen(content) : false;
  }

  show(): void {
    this.#show("programmatic");
  }

  hide(returnValue = ""): void {
    this.#hide("programmatic", returnValue);
  }

  toggle(force?: boolean): void {
    if (force === true) {
      this.show();
      return;
    }
    if (force === false) {
      this.hide();
      return;
    }
    if (this.open) {
      this.hide();
    } else {
      this.show();
    }
  }

  [openFromTrigger](trigger: HTMLElement): void {
    this.#prepareParts();
    this.#invoker = trigger;
    if (this.open) {
      this.#hide("trigger", "");
    } else {
      this.#show("trigger");
    }
  }

  [synchronizeTriggers](): void {
    const content = this.#content;
    if (content) {
      this.#synchronizeTriggers(content);
    } else {
      this.#releaseManagedTriggers();
    }
  }

  get #content(): HTMLElement | undefined {
    return Array.from(this.querySelectorAll<HTMLElement>(contentSelector)).find(
      (content) => belongsToRoot(content, this),
    );
  }

  #show(reason: "programmatic" | "trigger"): void {
    const content = this.#content;
    if (!content || isPopoverOpen(content)) {
      return;
    }

    const activeElement = this.ownerDocument.activeElement;
    this.#invoker ??=
      activeElement instanceof HTMLElement ? activeElement : undefined;
    this.#returnValue = "";
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

  #hide(reason: PopoverCloseReason | "trigger", returnValue = ""): void {
    const content = this.#content;
    if (!content || !isPopoverOpen(content)) {
      return;
    }

    this.#pendingReason = reason;
    this.#returnValue = returnValue;
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

  #onOpened(content: HTMLElement, reason: "programmatic" | "trigger"): void {
    this.#openReason = undefined;
    this.#setOpenState(true);
    this.#syncTriggerMetrics(content);
    this.#startPositioner(content);
    this.#getInitialFocus(content).focus();
    this.#dispatchOpenChange({
      open: true,
      reason,
      returnValue: "",
    });
  }

  #afterClose(
    content: HTMLElement,
    reason: PopoverCloseReason | "trigger",
  ): void {
    this.#stopPositioner();
    this.#clearTriggerMetrics(content);
    this.#setOpenState(false);
    this.#resolveFinalFocus(content)?.focus();
    this.#invoker = undefined;

    this.#dispatchOpenChange({
      open: false,
      reason,
      returnValue: this.#returnValue,
    });
    this.#returnValue = "";
    this.#pendingReason = "programmatic";
  }

  #prepareParts(): void {
    if (!this.id) {
      generatedId += 1;
      this.id = `ormo-popover-${generatedId}`;
    }

    const contents = Array.from(
      this.querySelectorAll<HTMLElement>(contentSelector),
    ).filter((content) => belongsToRoot(content, this));
    const content = contents[0];

    if (!content) {
      this.#stopPositioner();
      if (import.meta.env.DEV) validatePopover(this);
      return;
    }

    content.id ||= `${this.id}-content`;
    content.setAttribute("role", "dialog");
    this.#applyPopoverMode(content);
    this.#applyAnchorName(content);

    const title = Array.from(
      content.querySelectorAll<HTMLElement>(titleSelector),
    ).find((element) => belongsToRoot(element, this));
    const description = Array.from(
      content.querySelectorAll<HTMLElement>(descriptionSelector),
    ).find((element) => belongsToRoot(element, this));

    if (title) {
      title.id ||= `${this.id}-title`;
      const generatedLabel = this.#generatedLabels.get(content);

      if (
        generatedLabel &&
        content.getAttribute("aria-labelledby") === generatedLabel
      ) {
        content.setAttribute("aria-labelledby", title.id);
        this.#generatedLabels.set(content, title.id);
      } else if (
        !content.hasAttribute("aria-label") &&
        !content.hasAttribute("aria-labelledby")
      ) {
        content.setAttribute("aria-labelledby", title.id);
        this.#generatedLabels.set(content, title.id);
      } else {
        this.#generatedLabels.delete(content);
      }
    } else {
      const generatedLabel = this.#generatedLabels.get(content);
      if (content.getAttribute("aria-labelledby") === generatedLabel) {
        content.removeAttribute("aria-labelledby");
      }
      this.#generatedLabels.delete(content);
    }

    if (description) {
      description.id ||= `${this.id}-description`;
      const generatedDescription = this.#generatedDescriptions.get(content);

      if (
        generatedDescription &&
        content.getAttribute("aria-describedby") === generatedDescription
      ) {
        content.setAttribute("aria-describedby", description.id);
        this.#generatedDescriptions.set(content, description.id);
      } else if (!content.hasAttribute("aria-describedby")) {
        content.setAttribute("aria-describedby", description.id);
        this.#generatedDescriptions.set(content, description.id);
      } else {
        this.#generatedDescriptions.delete(content);
      }
    } else {
      const generatedDescription = this.#generatedDescriptions.get(content);
      if (content.getAttribute("aria-describedby") === generatedDescription) {
        content.removeAttribute("aria-describedby");
      }
      this.#generatedDescriptions.delete(content);
    }

    this.#synchronizeTriggers(content);
    this.#setOpenState(isPopoverOpen(content));
    if (import.meta.env.DEV) validatePopover(this);
  }

  #applyPopoverMode(content: HTMLElement): void {
    const manual = this.hasAttribute("data-disable-pointer-dismissal");
    content.setAttribute("popover", manual ? "manual" : "auto");
  }

  #applyAnchorName(content: HTMLElement): void {
    const anchorName = `--${this.id}`;
    content.style.setProperty("--ormo-popover-anchor", anchorName);

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
      "--ormo-popover-trigger-width",
      `${rect.width}px`,
    );
    content.style.setProperty(
      "--ormo-popover-trigger-height",
      `${rect.height}px`,
    );
  }

  #clearTriggerMetrics(content: HTMLElement): void {
    content.style.removeProperty("--ormo-popover-trigger-width");
    content.style.removeProperty("--ormo-popover-trigger-height");
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
      content.removeAttribute("data-ormo-popover-positioning");
      return;
    }

    content.setAttribute("data-ormo-popover-positioning", "floating");
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

    content.removeAttribute("data-ormo-popover-positioning");
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
    }

    for (const trigger of this.#managedTriggers) {
      trigger.dataset.state = state;
      trigger.toggleAttribute("data-open", open);
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
    }
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

    const open = isPopoverOpen(content);
    const anchorName = `--${this.id}`;

    for (const trigger of triggers) {
      if (!this.#triggerSnapshots.has(trigger)) {
        this.#triggerSnapshots.set(trigger, {
          ariaControls: trigger.getAttribute("aria-controls"),
          ariaExpanded: trigger.getAttribute("aria-expanded"),
          ariaHasPopup: trigger.getAttribute("aria-haspopup"),
          dataOpen: trigger.hasAttribute("data-open"),
          dataState: trigger.dataset.state,
        });
      }

      this.#managedTriggers.add(trigger);
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-controls", content.id);
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      trigger.dataset.state = open ? "open" : "closed";
      trigger.toggleAttribute("data-open", open);
      trigger.style.setProperty("anchor-name", anchorName);
    }
  }

  #releaseTrigger(trigger: HTMLElement): void {
    const snapshot = this.#triggerSnapshots.get(trigger);
    this.#managedTriggers.delete(trigger);
    this.#triggerSnapshots.delete(trigger);
    trigger.style.removeProperty("anchor-name");

    if (!snapshot) return;

    if (snapshot.ariaControls === null) {
      trigger.removeAttribute("aria-controls");
    } else {
      trigger.setAttribute("aria-controls", snapshot.ariaControls);
    }

    if (snapshot.ariaExpanded === null) {
      trigger.removeAttribute("aria-expanded");
    } else {
      trigger.setAttribute("aria-expanded", snapshot.ariaExpanded);
    }

    if (snapshot.ariaHasPopup === null) {
      trigger.removeAttribute("aria-haspopup");
    } else {
      trigger.setAttribute("aria-haspopup", snapshot.ariaHasPopup);
    }

    if (snapshot.dataState === undefined) {
      delete trigger.dataset.state;
    } else {
      trigger.dataset.state = snapshot.dataState;
    }
    trigger.toggleAttribute("data-open", snapshot.dataOpen);
  }

  #releaseManagedTriggers(): void {
    for (const trigger of Array.from(this.#managedTriggers)) {
      this.#releaseTrigger(trigger);
    }
  }

  #getTabbableElements(content: HTMLElement): HTMLElement[] {
    return getTabbableElements(content, (element) =>
      belongsToRoot(element, this),
    );
  }

  #getInitialFocus(content: HTMLElement): HTMLElement {
    const autofocusTarget = Array.from(
      content.querySelectorAll<HTMLElement>("[autofocus]"),
    ).find(
      (element) =>
        belongsToRoot(element, this) && isProgrammaticallyFocusable(element),
    );

    if (autofocusTarget) {
      return autofocusTarget;
    }

    const tabbableElements = this.#getTabbableElements(content);
    return tabbableElements[0] ?? content;
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
      if (this.#transitionVersion === version && isPopoverOpen(content)) {
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
      if (this.#transitionVersion !== version || isPopoverOpen(content)) {
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

  #resolveFinalFocus(content: HTMLElement): HTMLElement | undefined {
    if (
      this.#finalFocus?.isConnected &&
      isProgrammaticallyFocusable(this.#finalFocus)
    ) {
      return this.#finalFocus;
    }

    const selector = content.dataset.finalFocus?.trim();
    if (selector) {
      try {
        const target = this.ownerDocument.querySelector<HTMLElement>(selector);
        if (target && isProgrammaticallyFocusable(target)) {
          return target;
        }

        if (import.meta.env.DEV) {
          console.warn(
            `[Ormo Popover] finalFocus selector "${selector}" must match a focusable element.`,
            this,
          );
        }
      } catch {
        if (import.meta.env.DEV) {
          console.warn(
            `[Ormo Popover] finalFocus selector "${selector}" is not valid CSS.`,
            this,
          );
        }
      }
    }

    return this.#invoker?.isConnected &&
      isProgrammaticallyFocusable(this.#invoker)
      ? this.#invoker
      : undefined;
  }

  #dispatchOpenChange(detail: PopoverOpenChangeDetail): void {
    this.dispatchEvent(
      new CustomEvent("ormo:popover-open-change", {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  }

  #handleClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || !(event.target instanceof Element)) {
      return;
    }

    const content = this.#content;
    if (!content || !isPopoverOpen(content)) {
      return;
    }

    const closeControl = event.target.closest<HTMLButtonElement>(closeSelector);
    if (closeControl && belongsToRoot(closeControl, this)) {
      this.#hide("close", closeControl.value);
    }
  };

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
      const reason = this.#pendingReason;
      this.#afterClose(content, reason);
    }
  };

  #handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || event.defaultPrevented || !this.open) {
      return;
    }

    this.#pendingReason = "escape";

    if (this.hasAttribute("data-disable-pointer-dismissal")) {
      event.preventDefault();
      this.#hide("escape");
    }
  };

  #handleDocumentPointerDown = (event: PointerEvent): void => {
    if (
      !this.open ||
      this.hasAttribute("data-disable-pointer-dismissal") ||
      !(event.target instanceof Element)
    ) {
      return;
    }

    const content = this.#content;
    if (!content) {
      return;
    }

    if (content.contains(event.target)) {
      return;
    }

    const trigger = event.target.closest<HTMLElement>(triggerSelector);
    if (trigger && getTriggerRoot(trigger) === this) {
      return;
    }

    // Native auto popover light-dismiss will close; record reason.
    this.#pendingReason = "outside";
  };

  #handleBeforeSwap = (): void => {
    const content = this.#content;
    if (!content || !isPopoverOpen(content)) {
      return;
    }

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

function getTriggerRoot(trigger: HTMLElement): OrmoPopover | undefined {
  if (trigger.hasAttribute(detachedTargetAttribute)) {
    const target = trigger.getAttribute(detachedTargetAttribute);
    const root = target ? trigger.ownerDocument.getElementById(target) : null;
    return root instanceof OrmoPopover ? root : undefined;
  }

  const root = trigger.closest(tagName);
  return root instanceof OrmoPopover ? root : undefined;
}

function registerPopover(root: OrmoPopover): void {
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
      "click",
      (event) => {
        if (event.defaultPrevented || !(event.target instanceof Element)) {
          return;
        }

        const trigger = event.target.closest<HTMLElement>(triggerSelector);
        if (!trigger) return;

        const triggerRoot = getTriggerRoot(trigger);
        if (!triggerRoot) {
          if (
            import.meta.env.DEV &&
            trigger.hasAttribute(detachedTargetAttribute)
          ) {
            console.warn(
              `[Ormo Popover] Trigger target "${trigger.getAttribute(detachedTargetAttribute) ?? ""}" must match a Popover.Root id.`,
              trigger,
            );
          }
          return;
        }

        triggerRoot[openFromTrigger](trigger);
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

function unregisterPopover(root: OrmoPopover): void {
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
  customElements.define(tagName, OrmoPopover);
}
