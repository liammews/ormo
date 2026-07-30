import type {
  DialogBeforeCloseDetail,
  DialogCloseReason,
  DialogOpenChangeDetail,
} from "../components/dialog/types";
import { getTabbableElements, isProgrammaticallyFocusable } from "./focus";
import { lockModalScroll, unlockModalScroll } from "./modal-scroll-lock";

const tagName = "ormo-dialog";
const triggerSelector = "[data-ormo-dialog-trigger]";
const detachedTargetAttribute = "data-ormo-dialog-for";
const contentSelector = "[data-ormo-dialog-content]";
const titleSelector = "[data-ormo-dialog-title]";
const descriptionSelector = "[data-ormo-dialog-description]";
const closeSelector = "[data-ormo-dialog-close]";
const closeControlSelector = closeSelector;
const startingStyleAttribute = "data-starting-style";
const endingStyleAttribute = "data-ending-style";
const openFromTrigger = Symbol("openFromTrigger");
const synchronizeTriggers = Symbol("synchronizeTriggers");

let generatedId = 0;

interface TriggerSnapshot {
  ariaControls: string | null;
  ariaHasPopup: string | null;
  dataOpen: boolean;
  dataState: string | undefined;
}

interface DialogDocumentState {
  controller: AbortController;
  observer: MutationObserver;
  pendingSynchronization: boolean;
  roots: Set<OrmoDialog>;
}

const documentStates = new WeakMap<Document, DialogDocumentState>();

function belongsToRoot(element: Element, root: HTMLElement): boolean {
  return element.closest(tagName) === root;
}

function setAttributeIfChanged(
  element: Element,
  name: string,
  value: string,
): void {
  if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}

export function validateDialog(root: HTMLElement): void {
  if (!import.meta.env.DEV) {
    return;
  }

  const contents = Array.from(
    root.querySelectorAll<HTMLDialogElement>(contentSelector),
  ).filter((content) => belongsToRoot(content, root));
  const content = contents[0];

  if (!content) {
    console.warn("[Ormo Dialog] Add Dialog.Content inside Dialog.Root.", root);
    return;
  }

  if (contents.length > 1) {
    console.warn(
      "[Ormo Dialog] Dialog.Root must contain only one Dialog.Content.",
      root,
    );
  }

  const title = Array.from(
    content.querySelectorAll<HTMLElement>(titleSelector),
  ).find((element) => belongsToRoot(element, root));
  const closeControls = Array.from(
    content.querySelectorAll<HTMLElement>(closeControlSelector),
  ).filter((element) => belongsToRoot(element, root));

  if (
    !title &&
    !content.hasAttribute("aria-label") &&
    !content.hasAttribute("aria-labelledby")
  ) {
    console.warn(
      "[Ormo Dialog] Add Dialog.Title or an aria-label to Dialog.Content.",
      root,
    );
  }

  if (closeControls.length === 0) {
    console.warn(
      "[Ormo Dialog] Add Dialog.Close so keyboard and touch screen reader users can close the dialog.",
      root,
    );
  }
}

export class OrmoDialog extends HTMLElement {
  #controller: AbortController | undefined;
  #generatedDescriptions = new WeakMap<HTMLDialogElement, string>();
  #generatedLabels = new WeakMap<HTMLDialogElement, string>();
  #finalFocus: HTMLElement | null = null;
  #invoker: HTMLElement | undefined;
  #managedContent: HTMLDialogElement | undefined;
  #managedTriggers = new Set<HTMLElement>();
  #modalOpen = false;
  #observer: MutationObserver | undefined;
  #pendingReason: DialogCloseReason = "programmatic";
  #transitionFrame: number | undefined;
  #transitionTimeout: ReturnType<typeof setTimeout> | undefined;
  #transitionVersion = 0;
  #triggerSnapshots = new WeakMap<HTMLElement, TriggerSnapshot>();

  connectedCallback(): void {
    registerDialog(this);
    this.#prepareParts();
    this.#controller?.abort();
    this.#controller = new AbortController();

    this.addEventListener("click", this.#handleClick, {
      signal: this.#controller.signal,
    });
    this.addEventListener("keydown", this.#handleKeyDown, {
      signal: this.#controller.signal,
    });
    this.addEventListener("cancel", this.#handleCancel, {
      capture: true,
      signal: this.#controller.signal,
    });
    this.addEventListener("close", this.#handleClose, {
      capture: true,
      signal: this.#controller.signal,
    });
    this.ownerDocument.addEventListener(
      "astro:before-swap",
      this.#handleBeforeSwap,
      { signal: this.#controller.signal },
    );

    this.#observer?.disconnect();
    this.#observer = new MutationObserver(() => this.#prepareParts());
    this.#observer.observe(this, {
      attributeFilter: [
        "aria-label",
        "aria-labelledby",
        "aria-describedby",
        "id",
      ],
      attributes: true,
      childList: true,
      subtree: true,
    });
  }

  disconnectedCallback(): void {
    const content = this.#managedContent ?? this.#content;
    if (content) {
      this.#normalizeClosedContent(content, {
        announce: false,
        restoreFocus: true,
      });
    }
    this.#managedContent = undefined;
    this.#invoker = undefined;
    this.#modalOpen = false;
    this.#pendingReason = "programmatic";

    unregisterDialog(this);
    this.#controller?.abort();
    this.#controller = undefined;
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#clearTransitionSchedule();
    unlockModalScroll(this.ownerDocument, this);
    this.#releaseManagedTriggers();
  }

  get finalFocus(): HTMLElement | null {
    return this.#finalFocus;
  }

  set finalFocus(value: HTMLElement | null) {
    this.#finalFocus = value;
  }

  get open(): boolean {
    return this.#content?.open ?? false;
  }

  showModal(): void {
    this.#showModal("programmatic");
  }

  [openFromTrigger](trigger: HTMLElement): void {
    this.#prepareParts();
    this.#invoker = trigger;
    this.#showModal("trigger");
  }

  [synchronizeTriggers](): void {
    const content = this.#content;
    if (content) {
      this.#synchronizeTriggers(content);
    } else {
      this.#releaseManagedTriggers();
    }
  }

  #showModal(reason: "programmatic" | "trigger"): void {
    const content = this.#content;

    if (!content || content.open) {
      return;
    }

    const activeElement = this.ownerDocument.activeElement;
    this.#invoker ??=
      activeElement instanceof HTMLElement ? activeElement : undefined;
    content.returnValue = "";
    this.#pendingReason = "programmatic";
    this.#beginStartingStyle(content);
    content.showModal();
    this.#modalOpen = true;
    lockModalScroll(this.ownerDocument, this);
    this.#setOpenState(true);

    this.#getInitialFocus(content).focus();
    this.#dispatchOpenChange({
      open: true,
      reason,
      returnValue: "",
    });
  }

  close(returnValue = ""): void {
    const content = this.#content;

    if (!content?.open) {
      return;
    }

    this.#pendingReason = "programmatic";
    this.#beginEndingStyle(content);
    content.close(returnValue);
  }

  get #content(): HTMLDialogElement | undefined {
    return Array.from(
      this.querySelectorAll<HTMLDialogElement>(contentSelector),
    ).find((content) => belongsToRoot(content, this));
  }

  #prepareParts(): void {
    if (!this.id) {
      generatedId += 1;
      this.id = `ormo-dialog-${generatedId}`;
    }

    const contents = Array.from(
      this.querySelectorAll<HTMLDialogElement>(contentSelector),
    ).filter((content) => belongsToRoot(content, this));
    const content = contents[0];
    const previousContent = this.#managedContent;

    if (previousContent && previousContent !== content) {
      this.#normalizeClosedContent(previousContent, {
        announce: this.isConnected,
        restoreFocus: true,
      });
    }
    this.#managedContent = content;

    if (!content) {
      this.#setOpenState(false);
      unlockModalScroll(this.ownerDocument, this);
      this.#releaseManagedTriggers();
      if (import.meta.env.DEV) validateDialog(this);
      return;
    }

    content.id ||= `${this.id}-content`;
    content.setAttribute("role", "dialog");
    content.setAttribute("aria-modal", "true");

    const title = Array.from(
      content.querySelectorAll<HTMLElement>(titleSelector),
    ).find((element) => belongsToRoot(element, this));
    const description = Array.from(
      content.querySelectorAll<HTMLElement>(descriptionSelector),
    ).find((element) => belongsToRoot(element, this));

    const generatedLabel = this.#generatedLabels.get(content);
    const labelledBy = content.getAttribute("aria-labelledby");
    const hasAuthoredLabelledBy =
      labelledBy !== null && labelledBy !== generatedLabel;

    if (content.hasAttribute("aria-label") || hasAuthoredLabelledBy) {
      if (generatedLabel && labelledBy === generatedLabel) {
        content.removeAttribute("aria-labelledby");
      }
      this.#generatedLabels.delete(content);
    } else if (title) {
      title.id ||= `${this.id}-title`;
      setAttributeIfChanged(content, "aria-labelledby", title.id);
      this.#generatedLabels.set(content, title.id);
    } else {
      if (generatedLabel && labelledBy === generatedLabel) {
        content.removeAttribute("aria-labelledby");
      }
      this.#generatedLabels.delete(content);
    }

    const generatedDescription = this.#generatedDescriptions.get(content);
    const describedBy = content.getAttribute("aria-describedby");
    const hasAuthoredDescription =
      describedBy !== null && describedBy !== generatedDescription;

    if (hasAuthoredDescription) {
      this.#generatedDescriptions.delete(content);
    } else if (description) {
      description.id ||= `${this.id}-description`;
      setAttributeIfChanged(content, "aria-describedby", description.id);
      this.#generatedDescriptions.set(content, description.id);
    } else {
      if (generatedDescription && describedBy === generatedDescription) {
        content.removeAttribute("aria-describedby");
      }
      this.#generatedDescriptions.delete(content);
    }

    if (content.open) {
      lockModalScroll(this.ownerDocument, this);
    } else {
      unlockModalScroll(this.ownerDocument, this);
    }

    this.#synchronizeTriggers(content);

    this.#setOpenState(content.open);
    if (import.meta.env.DEV) validateDialog(this);
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

  #synchronizeTriggers(content: HTMLDialogElement): void {
    const triggers = new Set(this.#getTriggers());

    for (const trigger of this.#managedTriggers) {
      if (!triggers.has(trigger)) {
        this.#releaseTrigger(trigger);
      }
    }

    for (const trigger of triggers) {
      if (!this.#triggerSnapshots.has(trigger)) {
        this.#triggerSnapshots.set(trigger, {
          ariaControls: trigger.getAttribute("aria-controls"),
          ariaHasPopup: trigger.getAttribute("aria-haspopup"),
          dataOpen: trigger.hasAttribute("data-open"),
          dataState: trigger.dataset.state,
        });
      }

      this.#managedTriggers.add(trigger);
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-controls", content.id);
      trigger.dataset.state = content.open ? "open" : "closed";
      trigger.toggleAttribute("data-open", content.open);
    }
  }

  #releaseTrigger(trigger: HTMLElement): void {
    const snapshot = this.#triggerSnapshots.get(trigger);
    this.#managedTriggers.delete(trigger);
    this.#triggerSnapshots.delete(trigger);

    if (!snapshot) return;

    if (snapshot.ariaControls === null) {
      trigger.removeAttribute("aria-controls");
    } else {
      trigger.setAttribute("aria-controls", snapshot.ariaControls);
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

  #getTabbableElements(content: HTMLDialogElement): HTMLElement[] {
    return getTabbableElements(content, (element) =>
      belongsToRoot(element, this),
    );
  }

  #getInitialFocus(content: HTMLDialogElement): HTMLElement {
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

  #normalizeClosedContent(
    content: HTMLDialogElement,
    options: { announce: boolean; restoreFocus: boolean },
  ): void {
    const wasOpen =
      this.#modalOpen || content.open || this.hasAttribute("data-open");

    this.#clearTransitionSchedule();
    content.removeAttribute(startingStyleAttribute);
    content.removeAttribute(endingStyleAttribute);
    if (content.open) {
      content.removeAttribute("open");
    }

    this.#modalOpen = false;
    content.dataset.state = "closed";
    content.removeAttribute("data-open");
    this.#setOpenState(false);
    unlockModalScroll(this.ownerDocument, this);

    if (options.restoreFocus && wasOpen) {
      this.#resolveFinalFocus(content)?.focus();
    }
    this.#invoker = undefined;
    this.#pendingReason = "programmatic";

    if (options.announce && wasOpen) {
      this.#dispatchOpenChange({
        open: false,
        reason: "programmatic",
        returnValue: content.returnValue,
      });
    }
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

  #beginStartingStyle(content: HTMLDialogElement): void {
    this.#clearTransitionSchedule();
    const version = this.#transitionVersion;
    content.removeAttribute(endingStyleAttribute);
    content.setAttribute(startingStyleAttribute, "");

    this.#transitionFrame = requestAnimationFrame(() => {
      this.#transitionFrame = undefined;
      if (this.#transitionVersion === version && content.open) {
        content.removeAttribute(startingStyleAttribute);
      }
    });
  }

  #beginEndingStyle(content: HTMLDialogElement): void {
    this.#clearTransitionSchedule();
    const version = this.#transitionVersion;
    content.removeAttribute(startingStyleAttribute);
    content.setAttribute(endingStyleAttribute, "");

    this.#transitionFrame = requestAnimationFrame(() => {
      this.#transitionFrame = undefined;
      if (this.#transitionVersion !== version || content.open) {
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

  #resolveFinalFocus(content: HTMLDialogElement): HTMLElement | undefined {
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
            `[Ormo Dialog] finalFocus selector "${selector}" must match a focusable element.`,
            this,
          );
        }
      } catch {
        if (import.meta.env.DEV) {
          console.warn(
            `[Ormo Dialog] finalFocus selector "${selector}" is not valid CSS.`,
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

  #dispatchOpenChange(detail: DialogOpenChangeDetail): void {
    this.dispatchEvent(
      new CustomEvent("ormo:dialog-open-change", {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  }

  #dispatchBeforeClose(detail: DialogBeforeCloseDetail): boolean {
    return this.dispatchEvent(
      new CustomEvent("ormo:dialog-before-close", {
        bubbles: true,
        cancelable: true,
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
    if (!content?.open) {
      return;
    }

    const closeControl =
      event.target.closest<HTMLButtonElement>(closeControlSelector);
    if (closeControl && belongsToRoot(closeControl, this)) {
      if (closeControl.type === "submit" && closeControl.form) {
        return;
      }

      if (
        !this.#dispatchBeforeClose({
          reason: "close",
          returnValue: closeControl.value,
          originalEvent: event,
        })
      ) {
        return;
      }
      this.#pendingReason = "close";
      this.#beginEndingStyle(content);
      content.close(closeControl.value);
      return;
    }

    if (
      event.target !== content ||
      this.hasAttribute("data-disable-pointer-dismissal") ||
      event.detail === 0
    ) {
      return;
    }

    const bounds = content.getBoundingClientRect();
    const outside =
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom;

    if (outside) {
      if (
        !this.#dispatchBeforeClose({
          reason: "outside",
          returnValue: "",
          originalEvent: event,
        })
      ) {
        return;
      }
      this.#pendingReason = "outside";
      this.#beginEndingStyle(content);
      content.close();
    }
  };

  #handleCancel = (event: Event): void => {
    if (event.target !== this.#content) {
      return;
    }

    if (
      !this.#dispatchBeforeClose({
        reason: "escape",
        returnValue: "",
        originalEvent: event,
      })
    ) {
      event.preventDefault();
      return;
    }

    this.#pendingReason = "escape";
    if (event.target instanceof HTMLDialogElement) {
      this.#beginEndingStyle(event.target);
    }
    setTimeout(() => {
      if (this.open) {
        this.#pendingReason = "programmatic";
        this.#content?.removeAttribute(endingStyleAttribute);
      }
    }, 0);
  };

  #handleKeyDown = (event: KeyboardEvent): void => {
    const content = this.#content;

    if (
      event.defaultPrevented ||
      event.key !== "Tab" ||
      !content?.open ||
      !(event.target instanceof Element) ||
      !content.contains(event.target)
    ) {
      return;
    }

    const focusCandidates = this.#getTabbableElements(content);
    const first = focusCandidates[0];
    const last = focusCandidates.at(-1);
    const activeElement = this.ownerDocument.activeElement;

    if (!first || !last) {
      event.preventDefault();
      return;
    }

    if (
      event.shiftKey &&
      (activeElement === first || activeElement === content)
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  #handleClose = (event: Event): void => {
    const content = this.#content;
    if (event.target !== content || !content || content.open) {
      return;
    }

    this.#modalOpen = false;
    const reason = this.#pendingReason;
    this.#pendingReason = "programmatic";
    if (!content.hasAttribute(endingStyleAttribute)) {
      this.#beginEndingStyle(content);
    }
    this.#setOpenState(false);
    unlockModalScroll(this.ownerDocument, this);

    this.#resolveFinalFocus(content)?.focus();
    this.#invoker = undefined;

    this.#dispatchOpenChange({
      open: false,
      reason,
      returnValue: content.returnValue,
    });
  };

  #handleBeforeSwap = (): void => {
    const content = this.#content;
    if (!content?.open) {
      return;
    }

    this.#clearTransitionSchedule();
    content.removeAttribute(startingStyleAttribute);
    content.removeAttribute(endingStyleAttribute);
    this.#pendingReason = "programmatic";
    content.close();
  };
}

function getTriggerRoot(trigger: HTMLElement): OrmoDialog | undefined {
  if (trigger.hasAttribute(detachedTargetAttribute)) {
    const target = trigger.getAttribute(detachedTargetAttribute);
    const root = target ? trigger.ownerDocument.getElementById(target) : null;
    return root instanceof OrmoDialog ? root : undefined;
  }

  const root = trigger.closest(tagName);
  return root instanceof OrmoDialog ? root : undefined;
}

function registerDialog(root: OrmoDialog): void {
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
        const triggerRoot = trigger ? getTriggerRoot(trigger) : undefined;
        if (!trigger) return;

        if (!triggerRoot) {
          if (
            import.meta.env.DEV &&
            trigger.hasAttribute(detachedTargetAttribute)
          ) {
            console.warn(
              `[Ormo Dialog] Trigger target "${trigger.getAttribute(detachedTargetAttribute) ?? ""}" must match a Dialog.Root id.`,
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

function unregisterDialog(root: OrmoDialog): void {
  const document = root.ownerDocument;
  const state = documentStates.get(document);
  if (!state) return;

  state.roots.delete(root);
  if (state.roots.size > 0) return;

  state.controller.abort();
  state.observer.disconnect();
  documentStates.delete(document);
}

if (!customElements.get(tagName)) {
  customElements.define(tagName, OrmoDialog);
}
