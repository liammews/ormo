import type {
  AlertDialogCloseReason,
  AlertDialogOpenChangeDetail,
} from "../components/alert-dialog/types";
import { getTabbableElements, isProgrammaticallyFocusable } from "./focus";
import { lockModalScroll, unlockModalScroll } from "./modal-scroll-lock";

const tagName = "ormo-alert-dialog";
const triggerSelector = "[data-ormo-alert-dialog-trigger]";
const detachedTargetAttribute = "data-ormo-alert-dialog-for";
const contentSelector = "[data-ormo-alert-dialog-content]";
const titleSelector = "[data-ormo-alert-dialog-title]";
const descriptionSelector = "[data-ormo-alert-dialog-description]";
const cancelSelector = "[data-ormo-alert-dialog-cancel]";
const actionSelector = "[data-ormo-alert-dialog-action]";
const closeControlSelector = `${cancelSelector}, ${actionSelector}`;
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

interface AlertDialogDocumentState {
  controller: AbortController;
  observer: MutationObserver;
  pendingSynchronization: boolean;
  roots: Set<OrmoAlertDialog>;
}

const documentStates = new WeakMap<Document, AlertDialogDocumentState>();

function belongsToRoot(element: Element, root: HTMLElement): boolean {
  return element.closest(tagName) === root;
}

export function validateAlertDialog(root: HTMLElement): void {
  if (!import.meta.env.DEV) {
    return;
  }

  const contents = Array.from(
    root.querySelectorAll<HTMLDialogElement>(contentSelector),
  ).filter((content) => belongsToRoot(content, root));
  const content = contents[0];

  if (!content) {
    console.warn(
      "[Ormo AlertDialog] Add AlertDialog.Content inside AlertDialog.Root.",
      root,
    );
    return;
  }

  if (contents.length > 1) {
    console.warn(
      "[Ormo AlertDialog] AlertDialog.Root must contain only one AlertDialog.Content.",
      root,
    );
  }

  const title = Array.from(
    content.querySelectorAll<HTMLElement>(titleSelector),
  ).find((element) => belongsToRoot(element, root));
  const description = Array.from(
    content.querySelectorAll<HTMLElement>(descriptionSelector),
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
      "[Ormo AlertDialog] Add AlertDialog.Title or an aria-label to AlertDialog.Content.",
      root,
    );
  }

  if (!description && !content.hasAttribute("aria-describedby")) {
    console.warn(
      "[Ormo AlertDialog] Add AlertDialog.Description or aria-describedby to identify the alert message.",
      root,
    );
  }

  if (closeControls.length === 0) {
    console.warn(
      "[Ormo AlertDialog] Add AlertDialog.Cancel or AlertDialog.Action so keyboard users can close the dialog.",
      root,
    );
  }
}

export class OrmoAlertDialog extends HTMLElement {
  #controller: AbortController | undefined;
  #generatedDescriptions = new WeakMap<HTMLDialogElement, string>();
  #generatedLabels = new WeakMap<HTMLDialogElement, string>();
  #finalFocus: HTMLElement | null = null;
  #invoker: HTMLElement | undefined;
  #managedTriggers = new Set<HTMLElement>();
  #observer: MutationObserver | undefined;
  #pendingReason: AlertDialogCloseReason = "programmatic";
  #transitionFrame: number | undefined;
  #transitionTimeout: ReturnType<typeof setTimeout> | undefined;
  #transitionVersion = 0;
  #triggerSnapshots = new WeakMap<HTMLElement, TriggerSnapshot>();

  connectedCallback(): void {
    registerAlertDialog(this);
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
    this.#observer.observe(this, { childList: true, subtree: true });
  }

  disconnectedCallback(): void {
    unregisterAlertDialog(this);
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
    this.#beginStartingStyle(content);
    content.showModal();
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
      this.id = `ormo-alert-dialog-${generatedId}`;
    }

    const contents = Array.from(
      this.querySelectorAll<HTMLDialogElement>(contentSelector),
    ).filter((content) => belongsToRoot(content, this));
    const content = contents[0];

    if (!content) {
      unlockModalScroll(this.ownerDocument, this);
      if (import.meta.env.DEV) validateAlertDialog(this);
      return;
    }

    content.id ||= `${this.id}-content`;
    content.setAttribute("role", "alertdialog");
    content.setAttribute("aria-modal", "true");

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

    if (content.open) {
      lockModalScroll(this.ownerDocument, this);
    } else {
      unlockModalScroll(this.ownerDocument, this);
    }

    this.#synchronizeTriggers(content);

    this.#setOpenState(content.open);
    if (import.meta.env.DEV) validateAlertDialog(this);
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
    return (
      tabbableElements.find((element) => element.matches(cancelSelector)) ??
      tabbableElements[0] ??
      content
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
            `[Ormo AlertDialog] finalFocus selector "${selector}" must match a focusable element.`,
            this,
          );
        }
      } catch {
        if (import.meta.env.DEV) {
          console.warn(
            `[Ormo AlertDialog] finalFocus selector "${selector}" is not valid CSS.`,
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

  #dispatchOpenChange(detail: AlertDialogOpenChangeDetail): void {
    this.dispatchEvent(
      new CustomEvent("ormo:alert-dialog-open-change", {
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

    const closeControl =
      event.target.closest<HTMLButtonElement>(closeControlSelector);
    if (!closeControl || !belongsToRoot(closeControl, this)) {
      return;
    }

    const content = this.#content;
    if (!content?.contains(closeControl)) {
      return;
    }

    this.#pendingReason = closeControl.matches(cancelSelector)
      ? "cancel"
      : "action";
    this.#beginEndingStyle(content);
    content.close(closeControl.value);
  };

  #handleCancel = (event: Event): void => {
    if (event.target !== this.#content) {
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
    if (event.target !== content || !content) {
      return;
    }

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

function getTriggerRoot(trigger: HTMLElement): OrmoAlertDialog | undefined {
  if (trigger.hasAttribute(detachedTargetAttribute)) {
    const target = trigger.getAttribute(detachedTargetAttribute);
    const root = target ? trigger.ownerDocument.getElementById(target) : null;
    return root instanceof OrmoAlertDialog ? root : undefined;
  }

  const root = trigger.closest(tagName);
  return root instanceof OrmoAlertDialog ? root : undefined;
}

function registerAlertDialog(root: OrmoAlertDialog): void {
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
              `[Ormo AlertDialog] Trigger target "${trigger.getAttribute(detachedTargetAttribute) ?? ""}" must match an AlertDialog.Root id.`,
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

function unregisterAlertDialog(root: OrmoAlertDialog): void {
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
  customElements.define(tagName, OrmoAlertDialog);
}
