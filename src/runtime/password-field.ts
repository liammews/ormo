import type {
  PasswordVisibilityChangeDetail,
  PasswordVisibilityChangeReason,
} from "../components/password-field/types";
import "./password-field.css";

const tagName = "ormo-password-field";
const inputSelector = "[data-ormo-password-field-input]";
const toggleSelector = "[data-ormo-password-field-toggle]";

function belongsToRoot(element: Element, root: HTMLElement): boolean {
  return element.closest(tagName) === root;
}

function hasAccessibleName(input: HTMLInputElement): boolean {
  if (input.getAttribute("aria-label")?.trim()) return true;
  const labelledBy = input.getAttribute("aria-labelledby")?.trim().split(/\s+/);
  if (
    labelledBy?.some((id) =>
      input.ownerDocument.getElementById(id)?.textContent?.trim(),
    )
  )
    return true;
  return Boolean(
    input.labels &&
    Array.from(input.labels).some((label) => label.textContent?.trim()),
  );
}

export function validatePasswordField(root: HTMLElement): void {
  if (!import.meta.env.DEV) return;
  const inputs = Array.from(
    root.querySelectorAll<HTMLInputElement>(inputSelector),
  ).filter((input) => belongsToRoot(input, root));
  const toggles = Array.from(
    root.querySelectorAll<HTMLButtonElement>(toggleSelector),
  ).filter((toggle) => belongsToRoot(toggle, root));
  if (inputs.length !== 1) {
    console.warn(
      `[Ormo PasswordField] Root needs exactly one PasswordField.Input; found ${inputs.length}.`,
      root,
    );
  }
  if (toggles.length !== 1) {
    console.warn(
      `[Ormo PasswordField] Root needs exactly one PasswordField.Toggle; found ${toggles.length}.`,
      root,
    );
  }
  const input = inputs[0];
  const toggle = toggles[0];
  if (!input) return;
  if (!hasAccessibleName(input)) {
    console.warn(
      "[Ormo PasswordField] Add a wrapping label, a label with for/id, aria-label, or aria-labelledby.",
      root,
    );
  }
  const autocomplete = input.autocomplete.trim().split(/\s+/);
  if (
    !autocomplete.includes("current-password") &&
    !autocomplete.includes("new-password")
  ) {
    console.warn(
      '[Ormo PasswordField] Set autocomplete to "current-password" or "new-password".',
      root,
    );
  }
  if (input.getAttribute("value")) {
    console.warn(
      "[Ormo PasswordField] Do not render a real password in the server HTML value attribute.",
      root,
    );
  }
  if (input.name && input.form?.method.toLowerCase() === "get") {
    console.warn(
      '[Ormo PasswordField] Submit passwords with method="post" so they do not enter URLs and access logs.',
      root,
    );
  }
  if (
    toggle &&
    input.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_PRECEDING
  ) {
    console.warn(
      "[Ormo PasswordField] Put PasswordField.Input before PasswordField.Toggle in focus order.",
      root,
    );
  }
  if (
    toggle &&
    (!toggle.dataset.showLabel?.trim() || !toggle.dataset.hideLabel?.trim())
  ) {
    console.warn(
      "[Ormo PasswordField] Give Toggle non-empty showLabel and hideLabel values.",
      root,
    );
  }
}

export class OrmoPasswordField extends HTMLElement {
  #controller: AbortController | undefined;
  #formController: AbortController | undefined;
  #observer: MutationObserver | undefined;
  #authoredAttributes = new Map<Element, Map<string, string | null>>();
  #visible = false;

  connectedCallback(): void {
    this.#controller?.abort();
    this.#formController?.abort();
    this.#observer?.disconnect();
    this.#controller = new AbortController();
    const signal = this.#controller.signal;
    this.#snapshotState();
    this.#visible = this.hasAttribute("data-visible");
    this.addEventListener("click", this.#onClick, { signal });
    this.ownerDocument.defaultView?.addEventListener(
      "pagehide",
      this.#onPageHide,
      {
        signal,
      },
    );
    this.#observer = new MutationObserver(this.#onMutation);
    this.#observer.observe(this, {
      attributeFilter: ["disabled", "form", "id"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    this.#bindForm();
    this.setAttribute("data-enhanced", "");
    this.#sync();
    validatePasswordField(this);
  }

  disconnectedCallback(): void {
    this.#controller?.abort();
    this.#formController?.abort();
    this.#observer?.disconnect();
    this.#controller = undefined;
    this.#formController = undefined;
    this.#observer = undefined;
    this.#restore();
    this.#visible = false;
    this.#sync();
    this.removeAttribute("data-enhanced");
    this.#authoredAttributes.clear();
  }

  get #input(): HTMLInputElement | undefined {
    return Array.from(
      this.querySelectorAll<HTMLInputElement>(inputSelector),
    ).find((input) => belongsToRoot(input, this));
  }

  get #toggle(): HTMLButtonElement | undefined {
    return Array.from(
      this.querySelectorAll<HTMLButtonElement>(toggleSelector),
    ).find((toggle) => belongsToRoot(toggle, this));
  }

  get visible(): boolean {
    return this.#visible;
  }

  set visible(value: boolean) {
    this.#setVisible(Boolean(value), "programmatic");
  }

  #snapshot(element: Element, names: string[]): void {
    let values = this.#authoredAttributes.get(element);
    if (!values) {
      values = new Map();
      this.#authoredAttributes.set(element, values);
    }
    for (const name of names)
      if (!values.has(name)) values.set(name, element.getAttribute(name));
  }

  #snapshotState(): void {
    this.#snapshot(this, [
      "data-enhanced",
      "data-state",
      "data-visible",
      "data-hidden",
    ]);
    if (this.#input)
      this.#snapshot(this.#input, [
        "spellcheck",
        "autocapitalize",
        "autocorrect",
        "data-state",
        "data-visible",
        "data-hidden",
      ]);
    if (this.#toggle)
      this.#snapshot(this.#toggle, [
        "aria-controls",
        "aria-label",
        "disabled",
        "data-state",
        "data-visible",
        "data-hidden",
        "data-disabled",
      ]);
  }

  #restore(): void {
    for (const [element, values] of this.#authoredAttributes) {
      for (const [name, value] of values) {
        if (value === null) element.removeAttribute(name);
        else element.setAttribute(name, value);
      }
    }
  }

  #wasAuthored(element: Element, name: string): boolean {
    const value = this.#authoredAttributes.get(element)?.get(name);
    return value !== undefined && value !== null;
  }

  #bindForm(): void {
    this.#formController?.abort();
    this.#formController = new AbortController();
    const form = this.#input?.form;
    if (!form) return;
    const signal = this.#formController.signal;
    form.addEventListener("reset", this.#onReset, { signal });
    form.addEventListener("submit", this.#onSubmit, { signal });
  }

  #setVisible(value: boolean, reason: PasswordVisibilityChangeReason): void {
    const input = this.#input;
    if (!input || value === this.#visible) return;
    const previousVisible = this.#visible;
    const selection = {
      direction: input.selectionDirection,
      end: input.selectionEnd,
      start: input.selectionStart,
    };
    this.#visible = value;
    input.type = value ? "text" : "password";
    if (selection.start !== null && selection.end !== null) {
      try {
        input.setSelectionRange(
          selection.start,
          selection.end,
          selection.direction ?? undefined,
        );
      } catch {
        // Some input implementations do not expose selection after type changes.
      }
    }
    this.#sync();
    const detail: PasswordVisibilityChangeDetail = {
      previousVisible,
      reason,
      visible: value,
    };
    this.dispatchEvent(
      new CustomEvent("ormo:password-visibility-change", {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  }

  #sync(): void {
    const input = this.#input;
    const toggle = this.#toggle;
    if (!input) return;
    const visible = this.#visible;
    const state = visible ? "visible" : "hidden";
    input.type = visible ? "text" : "password";
    input.spellcheck = false;
    input.setAttribute("autocapitalize", "none");
    input.setAttribute("autocorrect", "off");
    for (const element of [this, input, ...(toggle ? [toggle] : [])]) {
      element.setAttribute("data-state", state);
      element.toggleAttribute("data-visible", visible);
      element.toggleAttribute("data-hidden", !visible);
    }
    if (toggle) {
      toggle.type = "button";
      toggle.setAttribute("aria-controls", input.id);
      toggle.setAttribute(
        "aria-label",
        visible
          ? (toggle.dataset.hideLabel ?? "")
          : (toggle.dataset.showLabel ?? ""),
      );
      const disabled = input.disabled || this.#wasAuthored(toggle, "disabled");
      toggle.disabled = disabled;
      toggle.toggleAttribute("data-disabled", disabled);
    }
  }

  #onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const toggle = target.closest<HTMLButtonElement>(toggleSelector);
    if (!toggle || !belongsToRoot(toggle, this) || toggle.disabled) return;
    this.#setVisible(!this.visible, "toggle");
    if (event.detail > 0) this.#input?.focus({ preventScroll: true });
  };

  #onMutation = (records: MutationRecord[]): void => {
    for (const record of records) {
      for (const node of record.removedNodes) {
        if (!(node instanceof Element)) continue;
        const removedInputs = [
          ...(node.matches(inputSelector) ? [node] : []),
          ...node.querySelectorAll(inputSelector),
        ];
        for (const removedInput of removedInputs) {
          if (!this.#authoredAttributes.has(removedInput)) continue;
          if (removedInput instanceof HTMLInputElement)
            removedInput.type = "password";
        }
      }
    }
    const input = this.#input;
    const needsSync = records.some(
      (record) =>
        record.type === "childList" ||
        (record.type === "attributes" && record.target === input),
    );
    if (!needsSync) return;
    this.#snapshotState();
    this.#bindForm();
    this.#sync();
    validatePasswordField(this);
  };

  #onReset = (): void => {
    queueMicrotask(() => this.#setVisible(false, "reset"));
  };

  #onSubmit = (): void => {
    this.#setVisible(false, "submit");
  };

  #onPageHide = (): void => {
    this.#setVisible(false, "pagehide");
  };
}

if (!customElements.get(tagName))
  customElements.define(tagName, OrmoPasswordField);
