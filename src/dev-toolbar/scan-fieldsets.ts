export interface FieldsetDiagnostic {
  element: HTMLElement;
  message: string;
}

function hasLegendName(legend: HTMLElement): boolean {
  return Boolean(
    legend.textContent?.trim() ||
    legend.querySelector('img[alt]:not([alt=""]), svg title'),
  );
}

export function scanFieldsets(
  root: ParentNode = document,
): FieldsetDiagnostic[] {
  const diagnostics: FieldsetDiagnostic[] = [];
  const fieldsets = root.querySelectorAll<HTMLFieldSetElement>(
    "fieldset[data-ormo-fieldset-root]",
  );

  for (const fieldset of fieldsets) {
    const legends = Array.from(fieldset.children).filter(
      (element): element is HTMLLegendElement =>
        element instanceof HTMLLegendElement,
    );
    const legend = legends[0];

    if (!legend) {
      diagnostics.push({
        element: fieldset,
        message: "Fieldset Root needs one direct Legend as its first child.",
      });
      continue;
    }

    if (fieldset.firstElementChild !== legend) {
      diagnostics.push({
        element: legend,
        message: "Fieldset Legend must be the first child of Fieldset Root.",
      });
    }

    if (legends.length > 1) {
      diagnostics.push({
        element: fieldset,
        message: "Fieldset Root must not contain more than one direct Legend.",
      });
    }

    if (!hasLegendName(legend)) {
      diagnostics.push({
        element: legend,
        message: "Fieldset Legend needs a non-empty accessible name.",
      });
    }
  }

  for (const legend of root.querySelectorAll<HTMLElement>(
    "[data-ormo-fieldset-legend]",
  )) {
    if (legend.parentElement?.localName !== "fieldset") {
      diagnostics.push({
        element: legend,
        message: "Fieldset Legend must be a direct child of a fieldset.",
      });
    }
  }

  return diagnostics;
}
