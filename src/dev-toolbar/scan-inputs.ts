export interface InputDiagnostic {
  element: HTMLInputElement;
  message: string;
}

function hasAccessibleName(input: HTMLInputElement): boolean {
  if (input.getAttribute("aria-label")?.trim()) {
    return true;
  }

  const labelledBy = input.getAttribute("aria-labelledby")?.trim().split(/\s+/);
  if (
    labelledBy?.some((id) =>
      input.ownerDocument.getElementById(id)?.textContent?.trim(),
    )
  ) {
    return true;
  }

  return (
    input.labels !== null &&
    Array.from(input.labels).some((label) => Boolean(label.textContent?.trim()))
  );
}

export function scanInputs(root: ParentNode = document): InputDiagnostic[] {
  const diagnostics: InputDiagnostic[] = [];

  for (const input of root.querySelectorAll<HTMLInputElement>(
    "input[data-ormo-input]:not([type='hidden'])",
  )) {
    if (!hasAccessibleName(input)) {
      diagnostics.push({
        element: input,
        message: "Input needs a visible label, aria-label, or aria-labelledby.",
      });
    }
  }

  return diagnostics;
}
