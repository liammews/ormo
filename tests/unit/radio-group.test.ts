import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  OrmoRadioGroupElement,
  RadioGroupValueChangeEvent,
} from "../../src/components/radio/types";
import { validateRadioGroup } from "../../src/runtime/radio-group";

interface GroupOptions {
  name?: string;
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
  values?: string[];
  disabledValues?: string[];
  withLabel?: boolean;
}

function createGroup(options: GroupOptions = {}): OrmoRadioGroupElement {
  const values = options.values ?? ["standard", "express", "pickup"];
  const root = document.createElement(
    "ormo-radio-group",
  ) as OrmoRadioGroupElement;
  root.setAttribute("role", "radiogroup");
  root.dataset.ormoRadioGroup = "";

  if (options.name) {
    root.dataset.name = options.name;
  }
  if (options.defaultValue !== undefined) {
    root.dataset.defaultValue = options.defaultValue;
  }
  if (options.disabled) {
    root.dataset.disabled = "";
  }
  if (options.required) {
    root.dataset.required = "";
  }

  const label =
    options.withLabel !== false
      ? `<span id="delivery-label" data-ormo-radio-group-label>Delivery</span>`
      : "";
  const members = values
    .map((value) => {
      const checked = options.defaultValue === value ? "checked" : "";
      const disabled = options.disabledValues?.includes(value)
        ? "disabled data-item-disabled"
        : "";
      return `<label>
        <input
          type="radio"
          data-ormo-radio
          value="${value}"
          name="${options.name ?? ""}"
          ${checked}
          ${disabled}
        >
        ${value}
      </label>`;
    })
    .join("");

  root.innerHTML = `${label}${members}`;
  if (options.withLabel !== false) {
    root.setAttribute("aria-labelledby", "delivery-label");
  }
  document.body.append(root);
  return root;
}

function getMembers(root: OrmoRadioGroupElement): HTMLInputElement[] {
  return Array.from(
    root.querySelectorAll<HTMLInputElement>("[data-ormo-radio]"),
  );
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("radio-group", () => {
  it("exposes the selected value and form", () => {
    const form = document.createElement("form");
    document.body.append(form);
    const root = createGroup({
      name: "delivery",
      defaultValue: "express",
    });
    form.append(root);

    expect(root.value).toBe("express");
    expect(root.form).toBe(form);
  });

  it("emits one member value-change event", () => {
    const root = createGroup({
      name: "delivery",
      defaultValue: "express",
    });
    const detail: RadioGroupValueChangeEvent["detail"][] = [];
    root.addEventListener("ormo:value-change", (event) => {
      detail.push(event.detail);
    });

    const standard = getMembers(root)[0]!;
    standard.checked = true;
    standard.dispatchEvent(new Event("change", { bubbles: true }));
    standard.dispatchEvent(new Event("change", { bubbles: true }));

    expect(root.value).toBe("standard");
    expect(detail).toEqual([{ value: "standard", reason: "member" }]);
  });

  it("sets and clears value without native change events", () => {
    const root = createGroup({
      name: "delivery",
      defaultValue: "express",
    });
    const nativeChange = vi.fn();
    const changes: RadioGroupValueChangeEvent["detail"][] = [];
    root.addEventListener("change", nativeChange);
    root.addEventListener("ormo:value-change", (event) => {
      changes.push(event.detail);
    });

    root.value = "pickup";
    root.value = "missing";
    root.value = null;

    expect(root.value).toBeNull();
    expect(nativeChange).not.toHaveBeenCalled();
    expect(changes).toEqual([
      { value: "pickup", reason: "programmatic" },
      { value: null, reason: "programmatic" },
    ]);
  });

  it("cascades disabled while preserving authored disabled state", () => {
    const root = createGroup({
      name: "delivery",
      disabledValues: ["pickup"],
    });
    const members = getMembers(root);

    root.disabled = true;
    expect(members.every((member) => member.disabled)).toBe(true);

    root.disabled = false;
    expect(members[0]!.disabled).toBe(false);
    expect(members[1]!.disabled).toBe(false);
    expect(members[2]!.disabled).toBe(true);
  });

  it("uses native group required validity", () => {
    const root = createGroup({ name: "delivery", required: true });
    const members = getMembers(root);

    expect(members.every((member) => member.required)).toBe(true);
    expect(root.valid).toBe(false);
    expect(root.checkValidity()).toBe(false);

    members[1]!.checked = true;
    members[1]!.dispatchEvent(new Event("change", { bubbles: true }));

    expect(root.valid).toBe(true);
    expect(root.checkValidity()).toBe(true);
  });

  it("preserves an authored required member when group required is removed", () => {
    const root = createGroup({ name: "delivery" });
    const members = getMembers(root);
    members[0]!.required = true;
    members[0]!.setAttribute("data-item-required-authored", "");

    root.required = true;
    root.required = false;

    expect(members[0]!.required).toBe(true);
    expect(members[1]!.required).toBe(false);
  });

  it("updates inherited names without overwriting authored names", async () => {
    const root = createGroup({ name: "delivery" });
    const members = getMembers(root);
    members[1]!.name = "custom-delivery";
    members[1]!.setAttribute("data-item-name-authored", "");

    root.name = "shipping";
    await Promise.resolve();

    expect(members[0]!.name).toBe("shipping");
    expect(members[1]!.name).toBe("custom-delivery");
    expect(members[2]!.name).toBe("shipping");
  });

  it("treats post-render member names as authored", async () => {
    const root = createGroup({ name: "delivery" });
    const member = getMembers(root)[0]!;

    member.name = "external-name";
    await Promise.resolve();

    expect(member.name).toBe("external-name");
    expect(member.hasAttribute("data-item-name-authored")).toBe(true);
  });

  it("updates managed label relationships", async () => {
    const root = createGroup({ name: "delivery" });
    root.removeAttribute("aria-labelledby");
    root.remove();
    document.body.append(root);

    expect(root.getAttribute("aria-labelledby")).toBe("delivery-label");

    const label = root.querySelector<HTMLElement>(
      "[data-ormo-radio-group-label]",
    )!;
    label.id = "shipping-label";
    await Promise.resolve();

    expect(root.getAttribute("aria-labelledby")).toBe("shipping-label");
  });

  it("restores the default selection on form reset without an event", async () => {
    const form = document.createElement("form");
    document.body.append(form);
    const root = createGroup({
      name: "delivery",
      defaultValue: "express",
    });
    form.append(root);
    const onValueChange = vi.fn();
    root.addEventListener("ormo:value-change", onValueChange);

    root.value = "pickup";
    onValueChange.mockClear();
    form.reset();
    await Promise.resolve();

    expect(root.value).toBe("express");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("warns when defaultValue conflicts with authored checked state", () => {
    const root = createGroup({
      name: "delivery",
      defaultValue: "express",
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    getMembers(root)[0]!.setAttribute("checked", "");

    validateRadioGroup(root);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Do not combine defaultValue"),
      root,
    );
  });
});
