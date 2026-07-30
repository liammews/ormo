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
    let detail: CheckboxGroupValueChangeEvent["detail"] | undefined;

    root.addEventListener("ormo:value-change", (event) => {
      detail = event.detail;
    });

    members[0]!.checked = true;
    members[0]!.dispatchEvent(new Event("change", { bubbles: true }));

    expect(detail).toEqual({
      value: ["http", "https"],
      reason: "member",
    });
    expect(root.dataset.state).toBe("partial");
  });

  it("identifies parent and programmatic value changes", () => {
    const root = createGroup({ name: "protocols", withParent: true });
    const reasons: CheckboxGroupValueChangeEvent["detail"]["reason"][] = [];

    root.addEventListener("ormo:value-change", (event) => {
      reasons.push(event.detail.reason);
    });

    const parent = getParent(root);
    parent.checked = true;
    parent.dispatchEvent(new Event("change", { bubbles: true }));
    root.value = ["http"];

    expect(reasons).toEqual(["parent", "programmatic"]);
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

  it("respects effective disabledness inherited from fieldset", async () => {
    const root = createGroup({
      name: "protocols",
      values: ["http", "ssh"],
      defaultValue: ["ssh"],
      withParent: true,
      required: true,
      requiredMessage: "Select at least one enabled protocol.",
    });
    const members = getMembers(root);
    const disabledFieldset = document.createElement("fieldset");
    disabledFieldset.disabled = true;
    root.append(disabledFieldset);
    disabledFieldset.append(members[1]!.closest("label")!);
    await Promise.resolve();

    expect(root.checkValidity()).toBe(false);
    expect(members[0]!.validationMessage).toBe(
      "Select at least one enabled protocol.",
    );

    const parent = getParent(root);
    parent.checked = true;
    parent.dispatchEvent(new Event("change", { bubbles: true }));
    expect(members[0]!.checked).toBe(true);
    expect(members[1]!.checked).toBe(true);

    parent.checked = false;
    parent.dispatchEvent(new Event("change", { bubbles: true }));
    expect(members[0]!.checked).toBe(false);
    expect(members[1]!.checked).toBe(true);
  });

  it("does not emit a value change when a parent cannot change members", () => {
    const root = createGroup({
      name: "protocols",
      values: ["http", "ssh"],
      disabledValues: ["http", "ssh"],
      withParent: true,
    });
    const onValueChange = vi.fn();
    root.addEventListener("ormo:value-change", onValueChange);

    const parent = getParent(root);
    parent.checked = true;
    parent.dispatchEvent(new Event("change", { bubbles: true }));

    expect(root.value).toEqual([]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("uses group labels when aria-label is empty", () => {
    const root = createGroup({ name: "protocols" });
    root.removeAttribute("aria-labelledby");
    root.setAttribute("aria-label", "");
    root.remove();
    document.body.append(root);

    expect(root.getAttribute("aria-labelledby")).toBe("protocols-label");
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

  it("preserves consumer custom validity", () => {
    const root = createGroup({ name: "protocols" });
    const members = getMembers(root);

    members[0]!.setCustomValidity("Server rejected this option.");
    root.requiredMessage = "Select at least one protocol.";
    root.required = true;

    expect(members[0]!.validationMessage).toBe("Server rejected this option.");
    expect(members[1]!.validationMessage).toBe("Select at least one protocol.");

    members[2]!.checked = true;
    members[2]!.dispatchEvent(new Event("change", { bubbles: true }));

    expect(members[0]!.validationMessage).toBe("Server rejected this option.");
    expect(members[1]!.validationMessage).toBe("");
    expect(root.checkValidity()).toBe(false);
  });

  it("reads validity without dispatching invalid", () => {
    const root = createGroup({
      name: "protocols",
      required: true,
      requiredMessage: "Select at least one protocol.",
    });
    const onInvalid = vi.fn();
    getMembers(root)[0]!.addEventListener("invalid", onInvalid);

    expect(root.valid).toBe(false);
    expect(onInvalid).not.toHaveBeenCalled();
  });

  it("dispatches one invalid event when reporting validity", () => {
    const root = createGroup({
      name: "protocols",
      required: true,
      requiredMessage: "Select at least one protocol.",
    });
    const target = getMembers(root)[0]!;
    const onInvalid = vi.fn();
    target.addEventListener("invalid", onInvalid);

    expect(root.reportValidity()).toBe(false);
    expect(onInvalid).toHaveBeenCalledTimes(1);
  });

  it("reasserts group validity before form submission", () => {
    const form = document.createElement("form");
    document.body.append(form);
    const root = createGroup({
      name: "protocols",
      required: true,
      requiredMessage: "Select at least one protocol.",
    });
    form.append(root);
    const member = getMembers(root)[0]!;

    member.setCustomValidity("Server error.");
    member.setCustomValidity("");

    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    form.addEventListener("submit", onSubmit);
    const submitted = form.dispatchEvent(
      new SubmitEvent("submit", { bubbles: true, cancelable: true }),
    );

    expect(submitted).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(member.validationMessage).toBe("Select at least one protocol.");
  });

  it("honors native validation bypass on forms and submitters", () => {
    const form = document.createElement("form");
    const saveDraft = document.createElement("button");
    saveDraft.type = "submit";
    saveDraft.formNoValidate = true;
    form.append(saveDraft);
    document.body.append(form);
    const root = createGroup({
      name: "protocols",
      required: true,
      requiredMessage: "Select at least one protocol.",
    });
    form.append(root);
    const member = getMembers(root)[0]!;
    member.setCustomValidity("");

    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    form.addEventListener("submit", onSubmit);

    form.noValidate = true;
    form.dispatchEvent(
      new SubmitEvent("submit", { bubbles: true, cancelable: true }),
    );

    form.noValidate = false;
    form.dispatchEvent(
      new SubmitEvent("submit", {
        bubbles: true,
        cancelable: true,
        submitter: saveDraft,
      }),
    );

    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(member.validationMessage).toBe("");
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

  it("sets disabled member values programmatically", () => {
    const root = createGroup({
      name: "protocols",
      defaultValue: ["ssh"],
      disabledValues: ["ssh"],
    });

    root.value = [];

    expect(root.value).toEqual([]);
    expect(getMembers(root)[2]!.checked).toBe(false);
    expect(root.dataset.state).toBe("none");
  });

  it("updates inherited names without overwriting authored names", async () => {
    const root = createGroup({ name: "protocols" });
    const members = getMembers(root);
    members[1]!.name = "custom-name";
    members[1]!.setAttribute("data-item-name-authored", "");

    root.name = "transport";
    await Promise.resolve();

    expect(members[0]!.name).toBe("transport");
    expect(members[1]!.name).toBe("custom-name");
    expect(members[2]!.name).toBe("transport");

    root.name = "";
    await Promise.resolve();

    expect(members[0]!.hasAttribute("name")).toBe(false);
    expect(members[1]!.name).toBe("custom-name");
    expect(members[2]!.hasAttribute("name")).toBe(false);
  });

  it("treats post-render member names as authored", async () => {
    const root = createGroup({ name: "protocols" });
    const member = getMembers(root)[0]!;

    member.name = "external-name";
    await Promise.resolve();

    expect(member.name).toBe("external-name");
    expect(member.hasAttribute("data-item-name-authored")).toBe(true);
  });

  it("reconciles parent state and validity after native form reset", async () => {
    const form = document.createElement("form");
    document.body.append(form);
    const root = createGroup({
      name: "protocols",
      values: ["http"],
      defaultValue: ["http"],
      required: true,
      requiredMessage: "Select at least one protocol.",
      withParent: true,
    });
    form.append(root);

    const member = getMembers(root)[0]!;
    const parent = getParent(root);
    expect(root.form).toBe(form);
    expect(root.dataset.state).toBe("all");
    expect(parent.checked).toBe(true);

    member.checked = false;
    member.dispatchEvent(new Event("change", { bubbles: true }));
    expect(root.checkValidity()).toBe(false);

    form.reset();
    await Promise.resolve();

    expect(member.checked).toBe(true);
    expect(root.dataset.state).toBe("all");
    expect(parent.checked).toBe(true);
    expect(parent.indeterminate).toBe(false);
    expect(member.validationMessage).toBe("");
    expect(root.checkValidity()).toBe(true);
  });
});
