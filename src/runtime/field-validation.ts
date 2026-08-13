import type {
  FieldControlElement,
  FieldValidatorContext,
} from "../components/field/types";

const internallyCheckedControls = new WeakSet<FieldControlElement>();

export function validityCheckWithoutRevalidation(
  control: FieldControlElement,
  check: () => boolean,
): boolean {
  internallyCheckedControls.add(control);
  try {
    return check();
  } finally {
    internallyCheckedControls.delete(control);
  }
}

export function checkValidityWithoutRevalidation(
  control: FieldControlElement,
): boolean {
  return validityCheckWithoutRevalidation(control, () =>
    control.checkValidity(),
  );
}

export function reportValidityWithoutRevalidation(
  control: FieldControlElement,
): boolean {
  return validityCheckWithoutRevalidation(control, () =>
    control.reportValidity(),
  );
}

export function isInternallyCheckedControl(
  control: FieldControlElement,
): boolean {
  return internallyCheckedControls.has(control);
}

export function getValidatorContext(
  control: FieldControlElement,
  signal: AbortSignal,
): FieldValidatorContext {
  let formData: FormData | null = null;
  if (control.form) {
    try {
      formData = new FormData(control.form);
    } catch {
      formData = null;
    }
  }
  return { formData, signal };
}
