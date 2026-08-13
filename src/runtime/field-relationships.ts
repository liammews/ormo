let generatedId = 0;

export function getRelationshipTokens(value: string | null): string[] {
  return value?.split(/\s+/).filter(Boolean) ?? [];
}

export function prepareFieldRelationshipIds(options: {
  root: HTMLElement;
  control: HTMLElement | undefined;
  group: HTMLElement | undefined;
  labels: HTMLLabelElement[];
  descriptions: HTMLElement[];
  errors: HTMLElement[];
  managedLabels: Set<HTMLLabelElement>;
}): void {
  const { root, control, group, labels, descriptions, errors, managedLabels } =
    options;
  if (!control && !group) return;
  if (!root.id) {
    generatedId += 1;
    root.id = `ormo-field-${generatedId}`;
  }
  if (control) control.id ||= `${root.id}-control`;
  if (group) group.id ||= `${root.id}-group`;

  labels.forEach((label, index) => {
    label.id ||= `${root.id}-label-${index + 1}`;
    if (control && (!label.htmlFor || managedLabels.has(label))) {
      if (label.htmlFor !== control.id) label.htmlFor = control.id;
      managedLabels.add(label);
    }
  });
  descriptions.forEach((element, index) => {
    element.id ||= `${root.id}-description-${index + 1}`;
  });
  errors.forEach((element, index) => {
    element.id ||= `${root.id}-error-${index + 1}`;
  });
}

export function setDescribedBy(
  target: HTMLElement,
  authoredIds: Iterable<string>,
  managedElements: HTMLElement[],
): Set<string> {
  const managedIds = new Set(managedElements.map((element) => element.id));
  const ids = Array.from(new Set([...authoredIds, ...managedIds]));
  if (ids.length > 0) {
    const value = ids.join(" ");
    if (target.getAttribute("aria-describedby") !== value) {
      target.setAttribute("aria-describedby", value);
    }
  } else if (target.hasAttribute("aria-describedby")) {
    target.removeAttribute("aria-describedby");
  }
  return managedIds;
}
