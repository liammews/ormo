import { afterEach, describe, expect, it, vi } from "vitest";

import type { OrmoFieldElement } from "../../src/components/field/types";
import { validateField } from "../../src/runtime/field";
import "../../src/runtime/field";

interface FieldOptions {
  disabled?: boolean;
  errorMatch?: string;
  inForm?: boolean;
  invalid?: boolean;
  controlAttributes?: string;
  controlMarkup?: string;
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
    ${
      options.controlMarkup ??
      `<input
      type="email"
      ${options.controlAttributes ?? ""}
      ${
        options.existingDescriptionId
          ? `aria-describedby="${options.existingDescriptionId}"`
          : ""
      }
    >`
    }
    <div data-ormo-field-description>Used for receipts.</div>
    <div
      data-ormo-field-error
      ${options.errorMatch ? `data-match="${options.errorMatch}" hidden` : "hidden"}
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
  it("wires its label, description, and visible error to the control", () => {
    const root = createField({
      existingDescriptionId: "external-hint",
      invalid: true,
    });
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
    expect(error?.hidden).toBe(false);
    expect(error?.getAttribute("role")).toBe("alert");
    expect(control.getAttribute("aria-describedby")?.split(/\s+/)).toEqual([
      "external-hint",
      description?.id,
      error?.id,
    ]);
  });

  it("omits hidden errors from aria-describedby until they apply", () => {
    const root = createField({
      controlAttributes: "required",
      validationMode: "onBlur",
    });
    const control = getControl(root);
    const description = root.querySelector<HTMLElement>(
      "[data-ormo-field-description]",
    );
    const error = root.querySelector<HTMLElement>("[data-ormo-field-error]");

    expect(error?.hidden).toBe(true);
    expect(control.getAttribute("aria-describedby")).toBe(description?.id);

    control.focus();
    control.blur();

    expect(error?.hidden).toBe(false);
    expect(control.getAttribute("aria-describedby")?.split(/\s+/)).toEqual([
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

  it("treats unchecked checkboxes as empty", () => {
    const root = createField({
      controlMarkup: '<input type="checkbox">',
    });
    const control = getControl(root);

    expect(root.state.filled).toBe(false);

    control.checked = true;
    control.dispatchEvent(new Event("input", { bubbles: true }));
    expect(root.state.filled).toBe(true);
  });

  it("owns a checkbox group for description and filled state", async () => {
    await import("../../src/runtime/checkbox-group");

    const root = document.createElement("ormo-field") as OrmoFieldElement;
    root.innerHTML = `
      <ormo-checkbox-group
        role="group"
        data-ormo-checkbox-group
        data-name="protocols"
        aria-labelledby="protocols-label"
      >
        <span id="protocols-label" data-ormo-checkbox-group-label>
          Protocols
        </span>
        <label>
          <input type="checkbox" data-ormo-checkbox value="http" name="protocols">
          HTTP
        </label>
        <label>
          <input type="checkbox" data-ormo-checkbox value="https" name="protocols">
          HTTPS
        </label>
      </ormo-checkbox-group>
      <div data-ormo-field-description>Choose allowed protocols.</div>
      <div data-ormo-field-error hidden>Select at least one protocol.</div>
    `;
    document.body.append(root);

    const group = root.querySelector("ormo-checkbox-group");
    const description = root.querySelector("[data-ormo-field-description]");
    const member = root.querySelector<HTMLInputElement>('input[value="http"]');

    expect(group?.getAttribute("aria-describedby")).toContain(
      description?.id ?? "",
    );
    expect(root.state.filled).toBe(false);

    member!.checked = true;
    member!.dispatchEvent(new Event("change", { bubbles: true }));

    expect(root.state.filled).toBe(true);
    expect(root.hasAttribute("data-filled")).toBe(true);
  });

  it("handles checkbox group invalid events without recursive validation", async () => {
    await import("../../src/runtime/checkbox-group");

    const root = document.createElement("ormo-field") as OrmoFieldElement;
    root.innerHTML = `
      <ormo-checkbox-group
        role="group"
        aria-label="Protocols"
        data-ormo-checkbox-group
        data-name="protocols"
        data-required
        data-required-message="Select at least one protocol."
      >
        <label>
          <input type="checkbox" data-ormo-checkbox value="http" name="protocols">
          HTTP
        </label>
      </ormo-checkbox-group>
      <div data-ormo-field-error hidden>Select at least one protocol.</div>
    `;
    document.body.append(root);

    const group = root.querySelector("ormo-checkbox-group")!;

    expect(() => group.checkValidity()).not.toThrow();
    expect(group.valid).toBe(false);
    expect(root.hasAttribute("data-invalid")).toBe(true);
  });

  it("supports submit, blur, and change validation modes", async () => {
    const submitField = createField({ controlAttributes: "required" });
    const submitControl = getControl(submitField);

    submitControl.focus();
    submitControl.blur();
    expect(submitField.state.invalid).toBe(false);
    expect(await submitField.validate()).toBe(false);
    expect(submitField.state.invalid).toBe(true);

    const changeField = createField({
      controlAttributes: 'type="email"',
      validationMode: "onChange",
    });
    const changeControl = getControl(changeField);

    changeControl.value = "not-an-email";
    changeControl.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await Promise.resolve();
    expect(changeField.state.invalid).toBe(true);

    changeControl.value = "person@example.com";
    changeControl.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await Promise.resolve();
    expect(changeField.state.valid).toBe(true);
  });

  it("matches errors against native validity reasons", async () => {
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
    await Promise.resolve();
    expect(error?.hidden).toBe(false);

    control.value = "person@example.com";
    control.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await Promise.resolve();
    expect(error?.hidden).toBe(true);
  });

  it("runs a synchronous validator and emits state changes", async () => {
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
    await Promise.resolve();
    expect(control.validity.customError).toBe(true);
    expect(root.state.invalid).toBe(true);

    control.value = "person@example.com";
    control.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await Promise.resolve();
    expect(control.validity.customError).toBe(false);
    expect(root.state.valid).toBe(true);
    expect(states).toContain(true);
    expect(states.at(-1)).toBe(false);
  });

  it("runs async validators and exposes validating state", async () => {
    const root = createField({ validationMode: "onChange" });
    const control = getControl(root);
    let resolveValidation!: (value: string | null) => void;

    root.validator = () =>
      new Promise((resolve) => {
        resolveValidation = resolve;
      });

    control.value = "person@example.com";
    control.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await Promise.resolve();

    expect(root.state.validating).toBe(true);
    expect(root.hasAttribute("data-validating")).toBe(true);

    resolveValidation("Use a different address.");
    await vi.waitFor(() => {
      expect(root.state.validating).toBe(false);
      expect(root.state.invalid).toBe(true);
      expect(control.validity.customError).toBe(true);
    });
  });

  it("debounces onChange validation", async () => {
    vi.useFakeTimers();
    const root = createField({ validationMode: "onChange" });
    root.validationDebounceTime = 100;
    const control = getControl(root);
    const validator = vi.fn(() => "Too soon");
    root.validator = validator;

    control.value = "a";
    control.dispatchEvent(new InputEvent("input", { bubbles: true }));
    control.value = "ab";
    control.dispatchEvent(new InputEvent("input", { bubbles: true }));

    expect(validator).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);

    expect(validator).toHaveBeenCalledOnce();
    expect(root.state.invalid).toBe(true);
    vi.useRealTimers();
  });

  it("propagates name, required, and readOnly to the control", () => {
    const root = createField();
    const control = getControl(root);

    root.name = "email";
    root.required = true;
    root.readOnly = true;

    expect(control.name).toBe("email");
    expect(control.required).toBe(true);
    expect(control.readOnly).toBe(true);
    expect(root.getAttribute("name")).toBe("email");
    expect(root.hasAttribute("data-required")).toBe(true);
    expect(root.hasAttribute("data-readonly")).toBe(true);
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

  it("focuses the first invalid field on submit", async () => {
    const form = document.createElement("form");
    const first = createField({ controlAttributes: "required" });
    const second = createField({ controlAttributes: "required" });
    first.remove();
    second.remove();
    form.append(first, second);
    document.body.append(form);

    const firstControl = getControl(first);
    const secondControl = getControl(second);
    const reportFirst = vi
      .spyOn(firstControl, "reportValidity")
      .mockReturnValue(false);
    const reportSecond = vi
      .spyOn(secondControl, "reportValidity")
      .mockReturnValue(false);
    const focusFirst = vi
      .spyOn(firstControl, "focus")
      .mockImplementation(() => undefined);
    const focusSecond = vi
      .spyOn(secondControl, "focus")
      .mockImplementation(() => undefined);

    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );

    await vi.waitFor(() => {
      expect(first.state.invalid).toBe(true);
      expect(second.state.invalid).toBe(true);
      expect(focusFirst).toHaveBeenCalledOnce();
      expect(reportFirst).toHaveBeenCalledOnce();
    });

    expect(focusSecond).not.toHaveBeenCalled();
    expect(reportSecond).not.toHaveBeenCalled();
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

describe("development diagnostics", () => {
  it("warns about missing labels, missing controls, and multiple controls", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const unlabeled = document.createElement("ormo-field");
    unlabeled.innerHTML = `<input type="text">`;
    document.body.append(unlabeled);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Field.Label"),
      unlabeled,
    );

    warn.mockClear();
    const empty = document.createElement("ormo-field");
    empty.innerHTML = `<label data-ormo-field-label>Name</label>`;
    document.body.append(empty);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("native input, select, or textarea"),
      empty,
    );

    warn.mockClear();
    const multiple = document.createElement("ormo-field");
    multiple.innerHTML = `
      <label data-ormo-field-label>Choice</label>
      <input type="radio" name="choice" value="a">
      <input type="radio" name="choice" value="b">
    `;
    document.body.append(multiple);
    validateField(multiple);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("only the first native control"),
      multiple,
    );
  });
});
