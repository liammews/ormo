import { afterEach, describe, expect, it } from "vitest";

import type { OrmoFieldElement } from "../../src/components/field/types";
import "../../src/runtime/field";

interface FieldOptions {
  disabled?: boolean;
  errorMatch?: string;
  inForm?: boolean;
  invalid?: boolean;
  controlAttributes?: string;
  existingDescriptionId?: string;
  validationMode?: "onSubmit" | "onBlur" | "onChange";
}

function createField(options: FieldOptions = {}): OrmoFieldElement {
  const root = document.createElement("ormo-field");

  if (options.disabled) {
    root.setAttribute("data-disabled", "");
  }

  if (options.invalid) {
    root.setAttribute("data-invalid", "");
  }

  if (options.validationMode) {
    root.dataset.validationMode = options.validationMode;
  }

  root.innerHTML = `
    <label data-ormo-field-label>Email address</label>
    <input
      type="email"
      ${options.controlAttributes ?? ""}
      ${
        options.existingDescriptionId
          ? `aria-describedby="${options.existingDescriptionId}"`
          : ""
      }
    >
    <div data-ormo-field-description>Used for receipts.</div>
    <div
      data-ormo-field-error
      ${options.errorMatch ? `data-match="${options.errorMatch}" hidden` : ""}
    >
      Enter a valid email address.
    </div>
  `;

  if (options.inForm) {
    const form = document.createElement("form");
    form.append(root);
    document.body.append(form);
  } else {
    document.body.append(root);
  }

  return root;
}

function getControl(root: OrmoFieldElement): HTMLInputElement {
  const control = root.querySelector("input");

  if (!control) {
    throw new Error("Expected field control");
  }

  return control;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("field", () => {
  it("wires its label, description, and error to the control", () => {
    const root = createField({ existingDescriptionId: "external-hint" });
    const control = getControl(root);
    const label = root.querySelector<HTMLLabelElement>(
      "[data-ormo-field-label]",
    );
    const description = root.querySelector<HTMLElement>(
      "[data-ormo-field-description]",
    );
    const error = root.querySelector<HTMLElement>("[data-ormo-field-error]");

    expect(root.id).not.toBe("");
    expect(control.id).not.toBe("");
    expect(label?.htmlFor).toBe(control.id);
    expect(label?.id).not.toBe("");
    expect(description?.id).not.toBe("");
    expect(error?.id).not.toBe("");
    expect(control.getAttribute("aria-describedby")?.split(/\s+/)).toEqual([
      "external-hint",
      description?.id,
      error?.id,
    ]);
  });

  it("preserves explicit accessible relationships", () => {
    const root = createField({
      controlAttributes: 'id="email" aria-describedby="email-help"',
    });
    const label = root.querySelector<HTMLLabelElement>(
      "[data-ormo-field-label]",
    );
    const control = getControl(root);

    label?.setAttribute("for", "email");
    root.remove();
    document.body.append(root);

    expect(control.id).toBe("email");
    expect(label?.htmlFor).toBe("email");
    expect(control.getAttribute("aria-describedby")).toContain("email-help");
  });

  it("tracks focus, filled, dirty, touched, and validity state", () => {
    const root = createField({
      controlAttributes: "required",
      validationMode: "onBlur",
    });
    const control = getControl(root);

    control.focus();
    expect(root.hasAttribute("data-focused")).toBe(true);
    expect(control.hasAttribute("data-focused")).toBe(true);

    control.value = "person@example.com";
    control.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(root.hasAttribute("data-filled")).toBe(true);
    expect(root.hasAttribute("data-dirty")).toBe(true);

    control.blur();
    expect(root.hasAttribute("data-focused")).toBe(false);
    expect(root.hasAttribute("data-touched")).toBe(true);
    expect(root.hasAttribute("data-valid")).toBe(true);
    expect(root.hasAttribute("data-invalid")).toBe(false);

    control.value = "";
    control.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(root.hasAttribute("data-invalid")).toBe(true);
    expect(control.getAttribute("aria-invalid")).toBe("true");
  });

  it("supports submit, blur, and change validation modes", () => {
    const submitField = createField({ controlAttributes: "required" });
    const submitControl = getControl(submitField);

    submitControl.focus();
    submitControl.blur();
    expect(submitField.state.invalid).toBe(false);
    expect(submitField.validate()).toBe(false);
    expect(submitField.state.invalid).toBe(true);

    const changeField = createField({
      controlAttributes: 'type="email"',
      validationMode: "onChange",
    });
    const changeControl = getControl(changeField);

    changeControl.value = "not-an-email";
    changeControl.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(changeField.state.invalid).toBe(true);

    changeControl.value = "person@example.com";
    changeControl.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(changeField.state.valid).toBe(true);
  });

  it("matches errors against native validity reasons", () => {
    const root = createField({
      controlAttributes: 'type="email"',
      errorMatch: "typeMismatch",
      validationMode: "onChange",
    });
    const control = getControl(root);
    const error = root.querySelector<HTMLElement>("[data-ormo-field-error]");

    expect(error?.hidden).toBe(true);

    control.value = "not-an-email";
    control.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(error?.hidden).toBe(false);

    control.value = "person@example.com";
    control.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(error?.hidden).toBe(true);
  });

  it("runs a synchronous validator and emits state changes", () => {
    const root = createField({ validationMode: "onChange" });
    const control = getControl(root);
    const states: boolean[] = [];

    root.validator = (value) =>
      value.endsWith("@example.com") ? null : "Use an example.com address.";
    root.addEventListener("ormo:state-change", (event) => {
      states.push(event.detail.state.invalid);
    });

    control.value = "person@elsewhere.com";
    control.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(control.validity.customError).toBe(true);
    expect(root.state.invalid).toBe(true);

    control.value = "person@example.com";
    control.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(control.validity.customError).toBe(false);
    expect(root.state.valid).toBe(true);
    expect(states).toContain(true);
    expect(states.at(-1)).toBe(false);
  });

  it("resets tracked state with its native form", async () => {
    const root = createField({
      controlAttributes: 'value="initial"',
      inForm: true,
      validationMode: "onBlur",
    });
    const control = getControl(root);

    control.value = "changed";
    control.dispatchEvent(new InputEvent("input", { bubbles: true }));
    control.focus();
    control.blur();
    expect(root.state.dirty).toBe(true);
    expect(root.state.touched).toBe(true);

    control.form?.reset();
    await Promise.resolve();

    expect(control.value).toBe("initial");
    expect(root.state.dirty).toBe(false);
    expect(root.state.touched).toBe(false);
    expect(root.state.valid).toBe(false);
  });

  it("rewires dynamically inserted parts and replacement controls", async () => {
    const root = createField();
    const originalControl = getControl(root);
    const description = document.createElement("div");
    description.setAttribute("data-ormo-field-description", "");
    description.textContent = "A new description";
    root.append(description);
    await Promise.resolve();

    expect(originalControl.getAttribute("aria-describedby")).toContain(
      description.id,
    );

    const replacement = document.createElement("input");
    replacement.type = "text";
    originalControl.replaceWith(replacement);
    await Promise.resolve();

    const label = root.querySelector<HTMLLabelElement>(
      "[data-ormo-field-label]",
    );
    expect(replacement.id).not.toBe("");
    expect(label?.htmlFor).toBe(replacement.id);
    expect(replacement.getAttribute("aria-describedby")).toContain(
      description.id,
    );
    expect(originalControl.hasAttribute("aria-describedby")).toBe(false);
  });

  it("propagates explicit invalid and disabled state", () => {
    const root = createField({ invalid: true, disabled: true });
    const control = getControl(root);
    const parts = Array.from(
      root.querySelectorAll(
        "[data-ormo-field-label], [data-ormo-field-description], [data-ormo-field-error]",
      ),
    );

    expect(root.invalid).toBe(true);
    expect(root.disabled).toBe(true);
    expect(control.disabled).toBe(true);
    expect(control.getAttribute("aria-invalid")).toBe("true");
    expect(parts.every((part) => part.hasAttribute("data-invalid"))).toBe(true);
    expect(parts.every((part) => part.hasAttribute("data-disabled"))).toBe(
      true,
    );

    root.invalid = false;
    root.disabled = false;

    expect(root.invalid).toBe(false);
    expect(root.disabled).toBe(false);
    expect(control.disabled).toBe(false);
    expect(control.hasAttribute("aria-invalid")).toBe(false);
  });
});
