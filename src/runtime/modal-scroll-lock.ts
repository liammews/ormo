const lockedAttribute = "data-ormo-scroll-locked";

interface ScrollLockState {
  owners: Set<Element>;
  overflowPriority: string;
  overflowValue: string;
}

const documentStates = new WeakMap<Document, ScrollLockState>();

/**
 * Prevents background document scrolling while one or more modal primitives
 * are open. Owners make nested Dialog and Alert Dialog instances cooperate.
 */
export function lockModalScroll(document: Document, owner: Element): void {
  let state = documentStates.get(document);

  if (!state) {
    const root = document.documentElement;
    state = {
      owners: new Set(),
      overflowPriority: root.style.getPropertyPriority("overflow"),
      overflowValue: root.style.getPropertyValue("overflow"),
    };
    documentStates.set(document, state);
    root.style.setProperty("overflow", "hidden", "important");
    root.setAttribute(lockedAttribute, "");
  }

  state.owners.add(owner);
}

export function unlockModalScroll(document: Document, owner: Element): void {
  const state = documentStates.get(document);
  if (!state) return;

  state.owners.delete(owner);
  if (state.owners.size > 0) return;

  const root = document.documentElement;
  root.removeAttribute(lockedAttribute);

  // Do not overwrite a deliberate style change made by application code while
  // the modal was open.
  if (
    root.style.getPropertyValue("overflow") === "hidden" &&
    root.style.getPropertyPriority("overflow") === "important"
  ) {
    if (state.overflowValue) {
      root.style.setProperty(
        "overflow",
        state.overflowValue,
        state.overflowPriority,
      );
    } else {
      root.style.removeProperty("overflow");
    }
  }

  documentStates.delete(document);
}
