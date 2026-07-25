import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  CheckboxGroupValueChangeEvent,
  OrmoCheckboxGroupElement,
} from "../../src/components/checkbox/types";
import "../../src/runtime/checkbox-group";

interface GroupOptions {
  name?: string;
  defaultValue?: string[];
  disabled?: boolean;
  required?: boolean;
  requiredMessage?: string;
  values?: string[];
  disabledValues?: string[];
  withParent?: boolean;
  withLabel?: boolean;
}

function createGroup(options: GroupOptions = {}): OrmoCheckboxGroupElement {
  const values = options.values ?? ["http", "https", "ssh"];
  const root = document.createElement(
    "ormo-checkbox-group",
  ) as OrmoCheckboxGroupElement;
  root.setAttribute("role", "group");
  root.dataset.ormoCheckboxGroup = "";

  if (options.name) {
    root.setAttribute("data-name", options.name);
  }

  if (options.defaultValue) {
    root.dataset.defaultValue = JSON.stringify(options.defaultValue);
  }

  if (options.disabled) {
    root.setAttribute("data-disabled", "");
  }

  if (options.required) {
    root.setAttribute("data-required", "");
    root.setAttribute(
      "data-required-message",
      options.requiredMessage ?? "Select at least one.",
    );
  }

  const label =
    options.withLabel !== false
      ? `<span id="protocols-label" data-ormo-checkbox-group-label>Protocols</span>`
      : "";

  const parent = options.withParent
    ? `<input type="checkbox" data-ormo-checkbox data-ormo-checkbox-parent aria-label="Select all">`
    : "";

  const members = values
    .map((value) => {
      const checked = options.defaultValue?.includes(value) ? "checked" : "";
      const disabled = options.disabledValues?.includes(value)
        ? "disabled data-item-disabled"
        : "";
      return `<label>
        <input
          type="checkbox"
          data-ormo-checkbox
          value="${value}"
          name="${options.name ?? ""}"
          ${checked}
          ${disabled}
        >
        ${value}
      </label>`;
    })
    .join("");

  root.innerHTML = `${label}${parent}${members}`;
  if (options.withLabel !== false) {
    root.setAttribute("aria-labelledby", "protocols-label");
  }
  document.body.append(root);
  return root;
}

function getMembers(root: OrmoCheckboxGroupElement): HTMLInputElement[] {
  return Array.from(
    root.querySelectorAll<HTMLInputElement>(
      "[data-ormo-checkbox]:not([data-ormo-checkbox-parent])",
    ),
  );
}

function getParent(root: OrmoCheckboxGroupElement): HTMLInputElement {
  const parent = root.querySelector<HTMLInputElement>(
    "[data-ormo-checkbox-parent]",
  );
  if (!parent) {
    throw new Error("Expected parent checkbox");
  }
  return parent;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("checkbox-group", () => {
  it("exposes checked member values and aggregate state", () => {
    const root = createGroup({
      name: "protocols",
      defaultValue: ["https"],
    });

    expect(root.value).toEqual(["https"]);
    expect(root.dataset.state).toBe("partial");
  });

  it("emits ormo:value-change when a member toggles", () => {
    const root = createGroup({ name: "protocols", defaultValue: ["https"] });
    const members = getMembers(root);
    let detail: string[] | undefined;

    root.addEventListener("ormo:value-change", (event) => {
      detail = (event as CheckboxGroupValueChangeEvent).detail.value;
    });

    members[0]!.checked = true;
    members[0]!.dispatchEvent(new Event("change", { bubbles: true }));

    expect(detail).toEqual(["http", "https"]);
    expect(root.dataset.state).toBe("partial");
  });

  it("reconciles a parent checkbox across none, partial, and all", () => {
    const root = createGroup({
      name: "protocols",
      withParent: true,
      defaultValue: ["https"],
    });
    const parent = getParent(root);
    const members = getMembers(root);

    expect(parent.indeterminate).toBe(true);
    expect(parent.checked).toBe(false);
    expect(root.dataset.state).toBe("partial");

    for (const member of members) {
      member.checked = true;
      member.dispatchEvent(new Event("change", { bubbles: true }));
    }

    expect(parent.indeterminate).toBe(false);
    expect(parent.checked).toBe(true);
    expect(root.dataset.state).toBe("all");

    for (const member of members) {
      member.checked = false;
      member.dispatchEvent(new Event("change", { bubbles: true }));
    }

    expect(parent.indeterminate).toBe(false);
    expect(parent.checked).toBe(false);
    expect(root.dataset.state).toBe("none");
  });

  it("selects and clears enabled members from the parent checkbox", () => {
    const root = createGroup({
      name: "protocols",
      withParent: true,
      disabledValues: ["ssh"],
    });
    const parent = getParent(root);
    const members = getMembers(root);

    parent.checked = true;
    parent.dispatchEvent(new Event("change", { bubbles: true }));

    expect(members[0]!.checked).toBe(true);
    expect(members[1]!.checked).toBe(true);
    expect(members[2]!.checked).toBe(false);
    expect(parent.indeterminate).toBe(true);
    expect(root.value).toEqual(["http", "https"]);

    parent.checked = false;
    parent.dispatchEvent(new Event("change", { bubbles: true }));

    expect(members[0]!.checked).toBe(false);
    expect(members[1]!.checked).toBe(false);
    expect(root.value).toEqual([]);
  });

  it("does not submit a parent checkbox name or value", () => {
    const root = createGroup({ name: "protocols", withParent: true });
    const parent = getParent(root);

    expect(parent.hasAttribute("name")).toBe(false);
    expect(parent.getAttribute("value")).toBeNull();
  });

  it("applies group required through custom validity", () => {
    const form = document.createElement("form");
    document.body.append(form);
    const root = createGroup({
      name: "protocols",
      required: true,
      requiredMessage: "Select at least one protocol.",
    });
    form.append(root);

    expect(root.checkValidity()).toBe(false);
    expect(getMembers(root)[0]!.validationMessage).toBe(
      "Select at least one protocol.",
    );

    getMembers(root)[0]!.checked = true;
    getMembers(root)[0]!.dispatchEvent(new Event("change", { bubbles: true }));

    expect(root.checkValidity()).toBe(true);
  });

  it("cascades disabled to members and supports the value setter", () => {
    const root = createGroup({ name: "protocols" });
    root.disabled = true;

    for (const member of getMembers(root)) {
      expect(member.disabled).toBe(true);
    }

    root.disabled = false;
    root.value = ["ssh", "http"];
    expect(root.value.sort()).toEqual(["http", "ssh"]);
    expect(root.dataset.state).toBe("partial");
  });
});
