import type { FieldControlElement } from "../components/field/types";

export interface RegisteredField extends HTMLElement {
  readonly state: { invalid: boolean };
  validate(): Promise<boolean>;
}

interface FormFieldRegistry {
  fields: Set<RegisteredField>;
  submitHandler: (event: SubmitEvent) => void;
}

const controlSelector = 'input:not([type="hidden"]), select, textarea';
const registries = new WeakMap<HTMLFormElement, FormFieldRegistry>();
const resumableForms = new WeakSet<HTMLFormElement>();

function isFieldControl(element: Element): element is FieldControlElement {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  );
}

function firstInvalidControl(
  form: HTMLFormElement,
): FieldControlElement | undefined {
  return Array.from(form.querySelectorAll(controlSelector))
    .filter(isFieldControl)
    .find((control) => {
      const field = control.closest<RegisteredField>("ormo-field");
      return field?.state.invalid === true;
    });
}

export function registerField(
  form: HTMLFormElement,
  field: RegisteredField,
  reportValidity: (control: FieldControlElement) => boolean,
): void {
  let registry = registries.get(form);

  if (!registry) {
    const submitHandler = (event: SubmitEvent): void => {
      if (
        resumableForms.has(form) ||
        form.noValidate ||
        (event.submitter instanceof HTMLButtonElement &&
          event.submitter.formNoValidate) ||
        (event.submitter instanceof HTMLInputElement &&
          event.submitter.formNoValidate)
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      const fields = Array.from(registries.get(form)?.fields ?? []).filter(
        (candidate) => candidate.isConnected,
      );

      void Promise.all(fields.map((candidate) => candidate.validate())).then(
        (results) => {
          const invalidControl = firstInvalidControl(form);
          if (results.includes(false) || invalidControl) {
            invalidControl?.focus();
            if (invalidControl && !invalidControl.validity.valid) {
              reportValidity(invalidControl);
            }
            return;
          }

          const submitter =
            event.submitter instanceof HTMLButtonElement ||
            event.submitter instanceof HTMLInputElement
              ? event.submitter
              : undefined;
          setTimeout(() => {
            if (!form.isConnected) return;
            resumableForms.add(form);
            try {
              form.requestSubmit(
                submitter && submitter.isConnected && submitter.form === form
                  ? submitter
                  : undefined,
              );
            } finally {
              resumableForms.delete(form);
            }
          }, 0);
        },
      );
    };

    registry = { fields: new Set(), submitHandler };
    registries.set(form, registry);
    form.addEventListener("submit", submitHandler, { capture: true });
  }

  registry.fields.add(field);
}

export function unregisterField(
  form: HTMLFormElement,
  field: RegisteredField,
): void {
  const registry = registries.get(form);
  if (!registry) return;
  registry.fields.delete(field);
  if (registry.fields.size === 0) {
    form.removeEventListener("submit", registry.submitHandler, {
      capture: true,
    });
    registries.delete(form);
  }
}
