import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrmoPasswordFieldElement } from "../../src/components/password-field/types";
import {
  OrmoPasswordField,
  validatePasswordField,
} from "../../src/runtime/password-field";

function createPasswordField({
  method = "post",
  valueAttribute = "",
}: {
  method?: "get" | "post";
  valueAttribute?: string;
} = {}): OrmoPasswordFieldElement {
  const form = document.createElement("form");
  form.method = method;
  form.innerHTML = `
    <label for="password">Password</label>
    <ormo-password-field data-state="hidden" data-hidden>
      <input
        id="password"
        type="password"
        name="password"
        autocomplete="current-password"
        spellcheck="false"
        autocapitalize="none"
        autocorrect="off"
        data-ormo-input
        data-ormo-password-field-input
        data-state="hidden"
        data-hidden
        ${valueAttribute}
      >
      <button
        type="button"
        aria-controls="password"
        aria-label="Show password"
        data-ormo-password-field-toggle
        data-show-label="Show password"
        data-hide-label="Hide password"
        data-state="hidden"
        data-hidden
      >Visibility</button>
    </ormo-password-field>
  `;
  document.body.append(form);
  return form.querySelector("ormo-password-field") as OrmoPasswordFieldElement;
}

function nextMutation(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("Password Field", () => {
  it("toggles visibility without copying the password into event detail", () => {
    const root = createPasswordField();
    const input = root.querySelector("input")!;
    const toggle = root.querySelector("button")!;
    const change = vi.fn();
    input.value = "correct horse battery staple";
    root.addEventListener("ormo:password-visibility-change", change);

    toggle.click();

    expect(root.visible).toBe(true);
    expect(input.type).toBe("text");
    expect(input.value).toBe("correct horse battery staple");
    expect(toggle.hasAttribute("aria-pressed")).toBe(false);
    expect(toggle.getAttribute("aria-label")).toBe("Hide password");
    expect(change.mock.calls[0]?.[0].detail).toEqual({
      previousVisible: false,
      reason: "toggle",
      visible: true,
    });
    expect(change.mock.calls[0]?.[0].detail).not.toHaveProperty("value");
  });

  it("preserves selection and applies safe text-mode attributes", () => {
    const root = createPasswordField();
    const input = root.querySelector("input")!;
    input.value = "long password";
    input.setSelectionRange(2, 6, "forward");

    root.visible = true;

    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(6);
    expect(input.spellcheck).toBe(false);
    expect(input.getAttribute("autocapitalize")).toBe("none");
    expect(input.getAttribute("autocorrect")).toBe("off");
  });

  it("returns pointer focus to the input and retains keyboard focus", () => {
    const root = createPasswordField();
    const input = root.querySelector("input")!;
    const toggle = root.querySelector("button")!;
    toggle.focus();
    toggle.click();
    expect(document.activeElement).toBe(toggle);

    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    expect(document.activeElement).toBe(input);
  });

  it("masks the password on submit, reset, pagehide, and disconnect", async () => {
    const root = createPasswordField();
    const form = root.closest("form")!;
    const input = root.querySelector("input")!;
    const changes = vi.fn();
    root.addEventListener("ormo:password-visibility-change", changes);

    root.visible = true;
    form.dispatchEvent(new Event("submit"));
    expect(input.type).toBe("password");
    expect(changes.mock.calls.at(-1)?.[0].detail.reason).toBe("submit");

    root.visible = true;
    form.reset();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(input.type).toBe("password");

    root.visible = true;
    window.dispatchEvent(new Event("pagehide"));
    expect(input.type).toBe("password");

    root.visible = true;
    root.remove();
    expect(input.type).toBe("password");
    expect(root.visible).toBe(false);
  });

  it("synchronises disabled state and dynamic parts", async () => {
    const root = document.createElement(
      "ormo-password-field",
    ) as OrmoPasswordFieldElement;
    root.innerHTML = `
      <input id="dynamic-password" type="password" autocomplete="new-password" aria-label="New password" data-ormo-password-field-input>
    `;
    document.body.append(root);
    const input = root.querySelector("input")!;
    const toggle = document.createElement("button");
    toggle.dataset.ormoPasswordFieldToggle = "";
    toggle.dataset.showLabel = "Show";
    toggle.dataset.hideLabel = "Hide";
    root.append(toggle);
    await nextMutation();

    expect(toggle.getAttribute("aria-controls")).toBe("dynamic-password");
    input.disabled = true;
    await nextMutation();
    expect(toggle.disabled).toBe(true);
    expect(toggle.hasAttribute("data-disabled")).toBe(true);
  });

  it("preserves an authored disabled toggle", () => {
    const root = createPasswordField();
    const form = root.closest("form")!;
    const toggle = root.querySelector("button")!;
    root.remove();
    toggle.disabled = true;
    form.append(root);

    expect(toggle.disabled).toBe(true);
    expect(toggle.hasAttribute("data-disabled")).toBe(true);
  });

  it("masks an input removed while visible", async () => {
    const root = createPasswordField();
    const input = root.querySelector("input")!;
    root.visible = true;

    input.remove();
    await nextMutation();

    expect(input.type).toBe("password");
  });

  it("scopes interaction to the owning nested root", () => {
    const outer = createPasswordField();
    const nested = document.createElement(
      "ormo-password-field",
    ) as OrmoPasswordFieldElement;
    nested.innerHTML = `
      <input id="nested-password" type="password" autocomplete="new-password" aria-label="Nested password" data-ormo-password-field-input>
      <button type="button" data-ormo-password-field-toggle data-show-label="Show nested" data-hide-label="Hide nested"></button>
    `;
    outer.append(nested);
    nested.querySelector("button")?.click();

    expect(nested.visible).toBe(true);
    expect(outer.visible).toBe(false);
  });

  it("reconnects without duplicate toggle events", () => {
    const root = createPasswordField();
    const form = root.closest("form")!;
    const toggle = root.querySelector("button")!;
    const change = vi.fn();
    root.addEventListener("ormo:password-visibility-change", change);
    root.remove();
    form.append(root);
    toggle.click();

    expect(change).toHaveBeenCalledOnce();
  });
});

describe("Password Field diagnostics", () => {
  it("reports unsafe GET submission and SSR password values", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const root = createPasswordField({
      method: "get",
      valueAttribute: 'value="do-not-render-me"',
    });
    warn.mockClear();

    validatePasswordField(root);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("server HTML value attribute"),
      root,
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('method="post"'),
      root,
    );
  });

  it("reports incomplete and unnamed compositions", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const root = document.createElement("ormo-password-field");
    root.innerHTML = `<input type="password" data-ormo-password-field-input>`;

    validatePasswordField(root);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("exactly one PasswordField.Toggle"),
      root,
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Add a wrapping label"),
      root,
    );
  });

  it("exports the custom element implementation", () => {
    expect(OrmoPasswordField).toBe(customElements.get("ormo-password-field"));
  });
});
