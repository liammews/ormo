import { defineToolbarApp } from "astro/toolbar";
import { scanFieldsets } from "./scan-fieldsets";
import { scanInputs } from "./scan-inputs";

interface Diagnostic {
  element: HTMLElement;
  message: string;
}

const interactiveSelector =
  'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';
const programmaticFocusSelector = `${interactiveSelector}, [tabindex="-1"]`;

function hasAccessibleName(element: HTMLElement): boolean {
  if (element.getAttribute("aria-label")?.trim()) {
    return true;
  }

  const labelledBy = element
    .getAttribute("aria-labelledby")
    ?.trim()
    .split(/\s+/);
  if (
    labelledBy?.some((id) =>
      element.ownerDocument.getElementById(id)?.textContent?.trim(),
    )
  ) {
    return true;
  }

  return Boolean(
    element.textContent?.trim() ||
    element.getAttribute("title")?.trim() ||
    element.querySelector('img[alt]:not([alt=""]), input[value], svg title'),
  );
}

function hasInputAccessibleName(input: HTMLInputElement): boolean {
  return (
    Boolean(input.getAttribute("aria-label")?.trim()) ||
    Boolean(
      input
        .getAttribute("aria-labelledby")
        ?.trim()
        .split(/\s+/)
        .some((id) =>
          Boolean(
            id && input.ownerDocument.getElementById(id)?.textContent?.trim(),
          ),
        ),
    ) ||
    (input.labels !== null &&
      Array.from(input.labels).some((label) =>
        Boolean(label.textContent?.trim()),
      ))
  );
}

function previousRenderedSibling(element: Element): Element | null {
  let sibling = element.previousElementSibling;

  while (sibling?.tagName === "SCRIPT") {
    sibling = sibling.previousElementSibling;
  }

  return sibling;
}

function scanButtons(): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const button of document.querySelectorAll<HTMLElement>(
    "[data-ormo-button]",
  )) {
    if (button.tabIndex > 0) {
      diagnostics.push({
        element: button,
        message: "Button should not use a positive tabindex.",
      });
    }

    if (button.querySelector(interactiveSelector)) {
      diagnostics.push({
        element: button,
        message: "Button contains a nested interactive element.",
      });
    }
  }

  return diagnostics;
}

function scanAlertDialogs(): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const trigger of document.querySelectorAll<HTMLElement>(
    "[data-ormo-alert-dialog-trigger][data-ormo-alert-dialog-for]",
  )) {
    const target = trigger.dataset.ormoAlertDialogFor?.trim();
    const root = target ? document.getElementById(target) : null;
    if (!root || root.localName !== "ormo-alert-dialog") {
      diagnostics.push({
        element: trigger,
        message: `Detached Alert Dialog Trigger does not match a Root id: ${target || "(empty)"}`,
      });
    }
  }

  for (const root of document.querySelectorAll<HTMLElement>(
    "ormo-alert-dialog",
  )) {
    const owns = (element: Element): boolean =>
      element.closest("ormo-alert-dialog") === root;
    const contents = Array.from(
      root.querySelectorAll<HTMLElement>("[data-ormo-alert-dialog-content]"),
    ).filter(owns);
    const content = contents[0];

    if (!content) {
      diagnostics.push({
        element: root,
        message: "Alert Dialog needs one Content part.",
      });
      continue;
    }

    if (contents.length > 1) {
      diagnostics.push({
        element: root,
        message: "Alert Dialog has more than one Content part.",
      });
    }

    const title = Array.from(
      content.querySelectorAll<HTMLElement>("[data-ormo-alert-dialog-title]"),
    ).find(owns);
    const description = Array.from(
      content.querySelectorAll<HTMLElement>(
        "[data-ormo-alert-dialog-description]",
      ),
    ).find(owns);
    const closeControl = Array.from(
      content.querySelectorAll<HTMLElement>(
        "[data-ormo-alert-dialog-cancel], [data-ormo-alert-dialog-action]",
      ),
    ).find(owns);

    if (
      !title &&
      !content.getAttribute("aria-label")?.trim() &&
      !content.getAttribute("aria-labelledby")?.trim()
    ) {
      diagnostics.push({
        element: content,
        message: "Alert Dialog needs a Title or another accessible name.",
      });
    }

    if (!description && !content.getAttribute("aria-describedby")?.trim()) {
      diagnostics.push({
        element: content,
        message: "Alert Dialog needs a Description or aria-describedby.",
      });
    }

    if (!closeControl) {
      diagnostics.push({
        element: content,
        message: "Alert Dialog needs a Cancel or Action response.",
      });
    }

    const finalFocus = content.dataset.finalFocus?.trim();
    if (finalFocus) {
      try {
        const target = document.querySelector<HTMLElement>(finalFocus);
        if (
          !target ||
          target.matches(":disabled") ||
          !target.matches(programmaticFocusSelector)
        ) {
          diagnostics.push({
            element: content,
            message: `Alert Dialog finalFocus does not match an available element: ${finalFocus}`,
          });
        }
      } catch {
        diagnostics.push({
          element: content,
          message: `Alert Dialog finalFocus is not valid CSS: ${finalFocus}`,
        });
      }
    }
  }

  return diagnostics;
}

function scanDialogs(): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const trigger of document.querySelectorAll<HTMLElement>(
    "[data-ormo-dialog-trigger][data-ormo-dialog-for]",
  )) {
    const target = trigger.dataset.ormoDialogFor?.trim();
    const root = target ? document.getElementById(target) : null;
    if (!root || root.localName !== "ormo-dialog") {
      diagnostics.push({
        element: trigger,
        message: `Detached Dialog Trigger does not match a Root id: ${target || "(empty)"}`,
      });
    }
  }

  for (const root of document.querySelectorAll<HTMLElement>("ormo-dialog")) {
    const owns = (element: Element): boolean =>
      element.closest("ormo-dialog") === root;
    const contents = Array.from(
      root.querySelectorAll<HTMLElement>("[data-ormo-dialog-content]"),
    ).filter(owns);
    const content = contents[0];

    if (!content) {
      diagnostics.push({
        element: root,
        message: "Dialog needs one Content part.",
      });
      continue;
    }

    if (contents.length > 1) {
      diagnostics.push({
        element: root,
        message: "Dialog has more than one Content part.",
      });
    }

    const title = Array.from(
      content.querySelectorAll<HTMLElement>("[data-ormo-dialog-title]"),
    ).find(owns);
    const close = Array.from(
      content.querySelectorAll<HTMLElement>("[data-ormo-dialog-close]"),
    ).find(owns);

    if (
      !title &&
      !content.getAttribute("aria-label")?.trim() &&
      !content.getAttribute("aria-labelledby")?.trim()
    ) {
      diagnostics.push({
        element: content,
        message: "Dialog needs a Title or another accessible name.",
      });
    }

    if (!close) {
      diagnostics.push({
        element: content,
        message: "Dialog needs a visible Close control.",
      });
    }

    const finalFocus = content.dataset.finalFocus?.trim();
    if (finalFocus) {
      try {
        const target = document.querySelector<HTMLElement>(finalFocus);
        if (
          !target ||
          target.matches(":disabled") ||
          !target.matches(programmaticFocusSelector)
        ) {
          diagnostics.push({
            element: content,
            message: `Dialog finalFocus does not match an available element: ${finalFocus}`,
          });
        }
      } catch {
        diagnostics.push({
          element: content,
          message: `Dialog finalFocus is not valid CSS: ${finalFocus}`,
        });
      }
    }
  }

  return diagnostics;
}

function scanPopovers(): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const trigger of document.querySelectorAll<HTMLElement>(
    "[data-ormo-popover-trigger][data-ormo-popover-for]",
  )) {
    const target = trigger.dataset.ormoPopoverFor?.trim();
    const root = target ? document.getElementById(target) : null;
    if (!root || root.localName !== "ormo-popover") {
      diagnostics.push({
        element: trigger,
        message: `Detached Popover Trigger does not match a Root id: ${target || "(empty)"}`,
      });
    }
  }

  for (const root of document.querySelectorAll<HTMLElement>("ormo-popover")) {
    const owns = (element: Element): boolean =>
      element.closest("ormo-popover") === root;
    const contents = Array.from(
      root.querySelectorAll<HTMLElement>("[data-ormo-popover-content]"),
    ).filter(owns);
    const content = contents[0];

    if (!content) {
      diagnostics.push({
        element: root,
        message: "Popover needs one Content part.",
      });
      continue;
    }

    if (contents.length > 1) {
      diagnostics.push({
        element: root,
        message: "Popover has more than one Content part.",
      });
    }

    const title = Array.from(
      content.querySelectorAll<HTMLElement>("[data-ormo-popover-title]"),
    ).find(owns);
    const close = Array.from(
      content.querySelectorAll<HTMLElement>("[data-ormo-popover-close]"),
    ).find(owns);

    if (
      !title &&
      !content.getAttribute("aria-label")?.trim() &&
      !content.getAttribute("aria-labelledby")?.trim()
    ) {
      diagnostics.push({
        element: content,
        message: "Popover needs a Title or another accessible name.",
      });
    }

    if (!close) {
      diagnostics.push({
        element: content,
        message: "Popover needs a visible Close control.",
      });
    }

    if (
      root.getAttribute("data-positioning") === "floating" &&
      !(globalThis as { __ormoPopoverFloatingPositioner?: unknown })
        .__ormoPopoverFloatingPositioner
    ) {
      diagnostics.push({
        element: root,
        message:
          'Popover positioning="floating" requires import "@ormo/primitives/popover/floating".',
      });
    }

    const finalFocus = content.dataset.finalFocus?.trim();
    if (finalFocus) {
      try {
        const target = document.querySelector<HTMLElement>(finalFocus);
        if (
          !target ||
          target.matches(":disabled") ||
          !target.matches(programmaticFocusSelector)
        ) {
          diagnostics.push({
            element: content,
            message: `Popover finalFocus does not match an available element: ${finalFocus}`,
          });
        }
      } catch {
        diagnostics.push({
          element: content,
          message: `Popover finalFocus is not valid CSS: ${finalFocus}`,
        });
      }
    }
  }

  return diagnostics;
}

function scanAvatars(): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const image of document.querySelectorAll<HTMLImageElement>(
    "[data-ormo-avatar-image]",
  )) {
    if (!image.hasAttribute("alt")) {
      diagnostics.push({
        element: image,
        message:
          'Avatar Image needs an alt attribute. Use a meaningful name, or alt="" when the avatar is decorative.',
      });
    }
  }

  return diagnostics;
}

function scanTooltips(): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const trigger of document.querySelectorAll<HTMLElement>(
    "[data-ormo-tooltip-trigger][data-ormo-tooltip-for]",
  )) {
    const target = trigger.dataset.ormoTooltipFor?.trim();
    const root = target ? document.getElementById(target) : null;
    if (!root || root.localName !== "ormo-tooltip") {
      diagnostics.push({
        element: trigger,
        message: `Detached Tooltip Trigger does not match a Root id: ${target || "(empty)"}`,
      });
    }
  }

  for (const root of document.querySelectorAll<HTMLElement>("ormo-tooltip")) {
    const owns = (element: Element): boolean =>
      element.closest("ormo-tooltip") === root;
    const contents = Array.from(
      root.querySelectorAll<HTMLElement>("[data-ormo-tooltip-content]"),
    ).filter(owns);
    const content = contents[0];

    if (!content) {
      diagnostics.push({
        element: root,
        message: "Tooltip needs one Content part.",
      });
      continue;
    }

    if (contents.length > 1) {
      diagnostics.push({
        element: root,
        message: "Tooltip has more than one Content part.",
      });
    }

    const focusables = Array.from(
      content.querySelectorAll<HTMLElement>(interactiveSelector),
    ).filter(owns);
    if (focusables.length > 0) {
      diagnostics.push({
        element: content,
        message:
          "Tooltip Content must not contain focusable elements. Use Popover for interactive content.",
      });
    }

    if (
      root.getAttribute("data-positioning") === "floating" &&
      !(globalThis as { __ormoTooltipFloatingPositioner?: unknown })
        .__ormoTooltipFloatingPositioner
    ) {
      diagnostics.push({
        element: root,
        message:
          'Tooltip positioning="floating" requires import "@ormo/primitives/tooltip/floating".',
      });
    }
  }

  return diagnostics;
}

function scanCheckboxes(): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const checkbox of document.querySelectorAll<HTMLInputElement>(
    "[data-ormo-checkbox]",
  )) {
    if (!hasInputAccessibleName(checkbox)) {
      diagnostics.push({
        element: checkbox,
        message: "Checkbox needs an accessible name.",
      });
    }

    if (
      checkbox.hasAttribute("data-ormo-checkbox-parent") &&
      !checkbox.closest("ormo-checkbox-group")
    ) {
      diagnostics.push({
        element: checkbox,
        message: "Parent Checkbox must be inside CheckboxGroup.",
      });
    }
  }

  for (const indicator of document.querySelectorAll<HTMLElement>(
    "[data-ormo-checkbox-indicator]",
  )) {
    const previous = previousRenderedSibling(indicator);
    const adjacent =
      (previous instanceof HTMLInputElement &&
        previous.hasAttribute("data-ormo-checkbox") &&
        previous) ||
      undefined;

    if (!adjacent) {
      diagnostics.push({
        element: indicator,
        message: "CheckboxIndicator should be a sibling of Checkbox.",
      });
    }
  }

  for (const group of document.querySelectorAll<HTMLElement>(
    "ormo-checkbox-group",
  )) {
    const labelledBy = group.getAttribute("aria-labelledby");
    const hasLabel =
      Boolean(group.getAttribute("aria-label")?.trim()) ||
      (labelledBy !== null &&
        labelledBy
          .split(/\s+/)
          .some((id) =>
            Boolean(
              id && group.ownerDocument.getElementById(id)?.textContent?.trim(),
            ),
          ));

    if (!hasLabel) {
      diagnostics.push({
        element: group,
        message:
          "CheckboxGroup needs CheckboxGroup.Label, aria-label, or aria-labelledby.",
      });
    }
  }

  return diagnostics;
}

function scanRadios(): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const radio of document.querySelectorAll<HTMLInputElement>(
    "[data-ormo-radio]",
  )) {
    if (!hasInputAccessibleName(radio)) {
      diagnostics.push({
        element: radio,
        message: "Radio needs an accessible name.",
      });
    }
  }

  for (const indicator of document.querySelectorAll<HTMLElement>(
    "[data-ormo-radio-indicator]",
  )) {
    const previous = previousRenderedSibling(indicator);
    const adjacent =
      (previous instanceof HTMLInputElement &&
        previous.hasAttribute("data-ormo-radio") &&
        previous) ||
      undefined;

    if (!adjacent) {
      diagnostics.push({
        element: indicator,
        message: "RadioIndicator should follow Radio under the same parent.",
      });
    }
  }

  for (const group of document.querySelectorAll<HTMLElement>(
    "ormo-radio-group",
  )) {
    const labelledBy = group.getAttribute("aria-labelledby");
    const hasLabel =
      Boolean(group.getAttribute("aria-label")?.trim()) ||
      (labelledBy !== null &&
        labelledBy
          .split(/\s+/)
          .some((id) =>
            Boolean(
              id && group.ownerDocument.getElementById(id)?.textContent?.trim(),
            ),
          ));

    if (!hasLabel) {
      diagnostics.push({
        element: group,
        message:
          "RadioGroup needs RadioGroup.Label, aria-label, or aria-labelledby.",
      });
    }

    const members = Array.from(
      group.querySelectorAll<HTMLInputElement>("[data-ormo-radio]"),
    ).filter((radio) => radio.closest("ormo-radio-group") === group);
    const names = new Set(members.map((member) => member.name));
    if (members.length > 0 && (names.size !== 1 || names.has(""))) {
      diagnostics.push({
        element: group,
        message: "RadioGroup members need one shared, non-empty name.",
      });
    }
  }

  return diagnostics;
}

function scan(): Diagnostic[] {
  return [
    ...scanButtons(),
    ...scanAlertDialogs(),
    ...scanDialogs(),
    ...scanPopovers(),
    ...scanTooltips(),
    ...scanAccordions(),
    ...scanAvatars(),
    ...scanTabs(),
    ...scanCheckboxes(),
    ...scanRadios(),
    ...scanFieldsets(),
    ...scanInputs(),
  ];
}

function scanAccordions(): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const root of document.querySelectorAll<HTMLElement>("ormo-accordion")) {
    const owns = (element: Element): boolean =>
      element.closest("ormo-accordion") === root;
    const items = Array.from(
      root.querySelectorAll<HTMLElement>("[data-ormo-accordion-item]"),
    ).filter(owns);
    const seenValues = new Map<string, HTMLElement>();

    if (items.length === 0) {
      diagnostics.push({
        element: root,
        message: "Accordion needs at least one Item.",
      });
      continue;
    }

    for (const item of items) {
      const value = item.dataset.value;
      const ownsItem = (element: Element): boolean =>
        element.closest("[data-ormo-accordion-item]") === item;
      const trigger = Array.from(
        item.querySelectorAll<HTMLElement>("[data-ormo-accordion-trigger]"),
      ).find(ownsItem);
      const content = Array.from(
        item.querySelectorAll<HTMLElement>("[data-ormo-accordion-content]"),
      ).find(ownsItem);

      if (value === undefined || value === "") {
        diagnostics.push({
          element: item,
          message: "Accordion Item needs a non-empty value.",
        });
      } else if (seenValues.has(value)) {
        diagnostics.push({
          element: item,
          message: `Accordion Item value is duplicated: ${value}`,
        });
      } else {
        seenValues.set(value, item);
      }

      if (!trigger) {
        diagnostics.push({
          element: item,
          message: "Accordion Item needs a Trigger.",
        });
      } else if (!hasAccessibleName(trigger)) {
        diagnostics.push({
          element: trigger,
          message: "Accordion Trigger needs an accessible name.",
        });
      }

      if (!content) {
        diagnostics.push({
          element: item,
          message: "Accordion Item needs a Content panel.",
        });
      }
    }
  }

  return diagnostics;
}

function scanTabs(): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const root of document.querySelectorAll<HTMLElement>("ormo-tabs")) {
    const owns = (element: Element): boolean =>
      element.closest("ormo-tabs") === root;
    const lists = Array.from(
      root.querySelectorAll<HTMLElement>("[data-ormo-tabs-list]"),
    ).filter(owns);
    const tabs = Array.from(
      root.querySelectorAll<HTMLElement>("[data-ormo-tabs-tab]"),
    ).filter(owns);
    const panels = Array.from(
      root.querySelectorAll<HTMLElement>("[data-ormo-tabs-panel]"),
    ).filter(owns);
    const tabValues = new Map<string, HTMLElement>();
    const panelValues = new Map<string, HTMLElement>();

    if (lists.length === 0) {
      diagnostics.push({
        element: root,
        message: "Tabs needs a List.",
      });
    }

    for (const list of lists) {
      const labelledBy = list.getAttribute("aria-labelledby");
      const hasLabel =
        Boolean(list.getAttribute("aria-label")?.trim()) ||
        (labelledBy !== null &&
          labelledBy
            .split(/\s+/)
            .some((id) =>
              Boolean(
                id &&
                list.ownerDocument.getElementById(id)?.textContent?.trim(),
              ),
            ));

      if (!hasLabel) {
        diagnostics.push({
          element: list,
          message:
            "Tabs List needs an accessible name via aria-label or aria-labelledby.",
        });
      }
    }

    for (const tab of tabs) {
      const value = tab.dataset.value;

      if (value === undefined || value === "") {
        diagnostics.push({
          element: tab,
          message: "Tabs Tab needs a non-empty value.",
        });
      } else if (tabValues.has(value)) {
        diagnostics.push({
          element: tab,
          message: `Tabs Tab value is duplicated: ${value}`,
        });
      } else {
        tabValues.set(value, tab);
      }

      if (!tab.closest("[data-ormo-tabs-list]")) {
        diagnostics.push({
          element: tab,
          message: "Tabs Tab should be inside Tabs List.",
        });
      }

      if (!hasAccessibleName(tab)) {
        diagnostics.push({
          element: tab,
          message: "Tabs Tab needs an accessible name.",
        });
      }
    }

    for (const panel of panels) {
      const value = panel.dataset.value;

      if (value === undefined || value === "") {
        diagnostics.push({
          element: panel,
          message: "Tabs Panel needs a non-empty value.",
        });
      } else if (panelValues.has(value)) {
        diagnostics.push({
          element: panel,
          message: `Tabs Panel value is duplicated: ${value}`,
        });
      } else {
        panelValues.set(value, panel);
      }
    }

    for (const [value, tab] of tabValues) {
      if (!panelValues.has(value)) {
        diagnostics.push({
          element: tab,
          message: `Tabs Tab value "${value}" has no matching Panel.`,
        });
      }
    }

    for (const [value, panel] of panelValues) {
      if (!tabValues.has(value)) {
        diagnostics.push({
          element: panel,
          message: `Tabs Panel value "${value}" has no matching Tab.`,
        });
      }
    }
  }

  return diagnostics;
}

function identify(element: HTMLElement): string {
  if (element.id) return `#${element.id}`;
  if (element.hasAttribute("data-ormo-alert-dialog-content")) return "Content";
  if (element.hasAttribute("data-ormo-dialog-content")) return "Content";
  if (element.hasAttribute("data-ormo-accordion-item")) return "Accordion Item";
  if (element.hasAttribute("data-ormo-accordion-trigger")) {
    return "Accordion Trigger";
  }
  if (element.hasAttribute("data-ormo-accordion-content")) {
    return "Accordion Content";
  }
  if (element.localName === "ormo-accordion") return "Accordion";
  if (element.hasAttribute("data-ormo-avatar-image")) return "Avatar Image";
  if (element.localName === "ormo-avatar") return "Avatar";
  if (element.hasAttribute("data-ormo-tabs-list")) return "Tabs List";
  if (element.hasAttribute("data-ormo-tabs-tab")) return "Tabs Tab";
  if (element.hasAttribute("data-ormo-tabs-panel")) return "Tabs Panel";
  if (element.localName === "ormo-tabs") return "Tabs";
  if (element.hasAttribute("data-ormo-checkbox-parent")) {
    return "Checkbox Parent";
  }
  if (element.hasAttribute("data-ormo-checkbox")) return "Checkbox";
  if (element.hasAttribute("data-ormo-checkbox-indicator")) {
    return "Checkbox Indicator";
  }
  if (element.localName === "ormo-checkbox-group") return "Checkbox Group";
  if (element.hasAttribute("data-ormo-radio")) return "Radio";
  if (element.hasAttribute("data-ormo-radio-indicator")) {
    return "Radio Indicator";
  }
  if (element.localName === "ormo-radio-group") return "Radio Group";
  if (element.hasAttribute("data-ormo-fieldset-legend")) {
    return "Fieldset Legend";
  }
  if (element.hasAttribute("data-ormo-fieldset-root")) return "Fieldset Root";
  if (element.hasAttribute("data-ormo-input")) return "Input";
  if (element.hasAttribute("data-ormo-button")) return "Button";
  return element.localName;
}

export default defineToolbarApp({
  init(canvas, app) {
    const style = document.createElement("style");
    style.textContent = `
      .panel {
        position: fixed;
        right: 1rem;
        bottom: 5rem;
        width: min(24rem, calc(100vw - 2rem));
        max-height: min(32rem, calc(100vh - 7rem));
        overflow: auto;
        border: 1px solid #34343a;
        border-radius: 0.75rem;
        padding: 1rem;
        background: #17171a;
        box-shadow: 0 1rem 3rem rgb(0 0 0 / 35%);
        color: #f7f7f8;
        font: 0.875rem/1.45 system-ui, sans-serif;
      }
      h1 { margin: 0; font-size: 1rem; }
      p { margin: 0.5rem 0 0; color: #c7c7ce; }
      ol { display: grid; gap: 0.5rem; margin: 0.75rem 0 0; padding: 0; list-style: none; }
      button {
        width: 100%;
        border: 1px solid #45454d;
        border-radius: 0.5rem;
        padding: 0.625rem;
        background: #242429;
        color: inherit;
        font: inherit;
        text-align: left;
      }
      button:hover { background: #303036; }
      button:focus-visible { outline: 2px solid #bda7ff; outline-offset: 2px; }
      strong { display: block; margin-bottom: 0.125rem; color: #ffffff; }
    `;

    const panel = document.createElement("section");
    panel.className = "panel";
    panel.setAttribute("aria-label", "Ormo diagnostics");
    const heading = document.createElement("h1");
    heading.textContent = "Ormo diagnostics";
    const summary = document.createElement("p");
    summary.setAttribute("aria-live", "polite");
    const list = document.createElement("ol");
    panel.append(heading, summary, list);
    canvas.append(style, panel);

    const render = (): void => {
      const diagnostics = scan();
      summary.textContent = diagnostics.length
        ? `${diagnostics.length} issue${diagnostics.length === 1 ? "" : "s"} found.`
        : "No Ormo issues found on this page.";
      list.replaceChildren();

      for (const diagnostic of diagnostics) {
        const item = document.createElement("li");
        const button = document.createElement("button");
        const location = document.createElement("strong");
        location.textContent = identify(diagnostic.element);
        button.append(location, diagnostic.message);
        button.addEventListener("click", () => {
          diagnostic.element.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          diagnostic.element.animate(
            [
              { outline: "3px solid #f7b955", outlineOffset: "4px" },
              { outline: "3px solid transparent", outlineOffset: "8px" },
            ],
            { duration: 1200, easing: "ease-out" },
          );
        });
        item.append(button);
        list.append(item);
      }

      app.toggleNotification({
        state: diagnostics.length > 0,
        level: "warning",
      });
    };

    let frame: number | undefined;
    const scheduleRender = (): void => {
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        render();
      });
    };
    let observer = new MutationObserver(scheduleRender);
    const observePage = (): void => {
      observer.disconnect();
      observer = new MutationObserver(scheduleRender);
      observer.observe(document.body, {
        attributes: true,
        childList: true,
        subtree: true,
      });
      render();
    };

    app.onToggled(({ state }) => {
      if (state) render();
    });
    document.addEventListener("astro:page-load", observePage);
    observePage();
  },
});
