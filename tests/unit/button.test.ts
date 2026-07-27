import { afterEach, describe, expect, it, vi } from "vitest";

import { setButtonState } from "../../src/components/button/state";
import { validateButtons } from "../../src/runtime/button";

function createButton(options: { disabled?: boolean } = {}): HTMLDivElement {
  const button = document.createElement("div");
  button.setAttribute("data-ormo-button", "");
  button.setAttribute("data-native-button", "false");
  button.setAttribute("role", "button");
  button.setAttribute("data-ormo-button-tabindex", "0");
  button.tabIndex = options.disabled ? -1 : 0;

  if (options.disabled) {
    button.setAttribute("aria-disabled", "true");
    button.setAttribute("data-disabled", "");
    button.setAttribute("data-ormo-button-disabled", "");
  }

  document.body.append(button);
  return button;
}

function pressKey(
  element: HTMLElement,
  type: "keydown" | "keyup",
  key: string,
): boolean {
  return element.dispatchEvent(
    new KeyboardEvent(type, { bubbles: true, cancelable: true, key }),
  );
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("non-native button", () => {
  it("activates once when Enter is pressed", () => {
    const button = createButton();
    const handleClick = vi.fn();
    button.addEventListener("click", handleClick);

    expect(pressKey(button, "keydown", "Enter")).toBe(true);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("prevents scrolling on Space down and activates on Space up", () => {
    const button = createButton();
    const handleClick = vi.fn();
    button.addEventListener("click", handleClick);

    expect(pressKey(button, "keydown", " ")).toBe(false);
    expect(handleClick).not.toHaveBeenCalled();

    pressKey(button, "keyup", " ");
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not activate from a Space keyup without a matching keydown", () => {
    const button = createButton();
    const handleClick = vi.fn();
    button.addEventListener("click", handleClick);

    pressKey(button, "keyup", " ");

    expect(handleClick).not.toHaveBeenCalled();
  });

  it("does not activate when a consumer cancels Space keydown", () => {
    const button = createButton();
    const handleClick = vi.fn();
    button.addEventListener("keydown", (event) => event.preventDefault());
    button.addEventListener("click", handleClick);

    pressKey(button, "keydown", " ");
    pressKey(button, "keyup", " ");

    expect(handleClick).not.toHaveBeenCalled();
  });

  it("clears a Space press when a consumer cancels keyup", () => {
    const button = createButton();
    const handleClick = vi.fn();
    const cancelKeyUp = (event: KeyboardEvent) => event.preventDefault();
    button.addEventListener("keyup", cancelKeyUp);
    button.addEventListener("click", handleClick);

    pressKey(button, "keydown", " ");
    pressKey(button, "keyup", " ");
    button.removeEventListener("keyup", cancelKeyUp);
    pressKey(button, "keyup", " ");

    expect(handleClick).not.toHaveBeenCalled();
  });

  it("cancels a Space press when focus leaves the button", () => {
    const button = createButton();
    const handleClick = vi.fn();
    button.addEventListener("click", handleClick);

    pressKey(button, "keydown", " ");
    button.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    pressKey(button, "keyup", " ");

    expect(handleClick).not.toHaveBeenCalled();
  });

  it("does not activate for unrelated keys", () => {
    const button = createButton();
    const handleClick = vi.fn();
    button.addEventListener("click", handleClick);

    pressKey(button, "keydown", "ArrowDown");
    pressKey(button, "keyup", "ArrowDown");

    expect(handleClick).not.toHaveBeenCalled();
  });

  it("allows a consumer to cancel keyboard activation", () => {
    const button = createButton();
    const handleClick = vi.fn();
    button.addEventListener("keydown", (event) => event.preventDefault());
    button.addEventListener("click", handleClick);

    pressKey(button, "keydown", "Enter");

    expect(handleClick).not.toHaveBeenCalled();
  });

  it("activates when consumers stop propagation without canceling", async () => {
    const button = createButton();
    const parent = button.parentElement!;
    const handleClick = vi.fn();
    button.addEventListener("keydown", (event) => event.stopPropagation());
    button.addEventListener("keyup", (event) => event.stopPropagation());
    parent.addEventListener("keydown", (event) => event.stopPropagation());
    parent.addEventListener("keyup", (event) => event.stopPropagation());
    button.addEventListener("click", handleClick);

    pressKey(button, "keydown", "Enter");
    await new Promise((resolve) => setTimeout(resolve, 0));
    pressKey(button, "keydown", " ");
    pressKey(button, "keyup", " ");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  it("honors cancellation from an ancestor after the target", () => {
    const button = createButton();
    const handleClick = vi.fn();
    document.body.addEventListener(
      "keydown",
      (event) => event.preventDefault(),
      { once: true },
    );
    button.addEventListener("click", handleClick);

    pressKey(button, "keydown", "Enter");

    expect(handleClick).not.toHaveBeenCalled();
  });

  it("uses the internal disabled marker rather than authored ARIA or styling", async () => {
    const button = createButton();
    const handleClick = vi.fn();
    button.addEventListener("click", handleClick);
    button.setAttribute("aria-disabled", "true");
    button.setAttribute("data-disabled", "");

    button.click();
    pressKey(button, "keydown", "Enter");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(handleClick).toHaveBeenCalledTimes(2);

    button.setAttribute("data-ormo-button-disabled", "");
    button.removeAttribute("aria-disabled");
    button.click();
    pressKey(button, "keydown", "Enter");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  it("suppresses pointer, keyboard, and programmatic clicks when disabled", () => {
    const button = createButton({ disabled: true });
    const handleClick = vi.fn();
    const handlePointerDown = vi.fn();
    button.addEventListener("click", handleClick);
    button.addEventListener("pointerdown", handlePointerDown);

    button.click();
    button.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, cancelable: true }),
    );
    pressKey(button, "keydown", "Enter");
    pressKey(button, "keydown", " ");
    pressKey(button, "keyup", " ");

    expect(handleClick).not.toHaveBeenCalled();
    expect(handlePointerDown).not.toHaveBeenCalled();
  });

  it("allows Tab and non-activation keys on a focusable disabled button", () => {
    const button = createButton({ disabled: true });
    button.tabIndex = 0;
    const handleKeyDown = vi.fn();
    button.addEventListener("keydown", handleKeyDown);

    expect(pressKey(button, "keydown", "Tab")).toBe(true);
    expect(pressKey(button, "keydown", "ArrowRight")).toBe(true);

    expect(handleKeyDown).toHaveBeenCalledTimes(2);
  });
});

describe("development diagnostics", () => {
  it("warns about positive tabindex and nested controls", () => {
    const button = createButton();
    button.textContent = "More";
    button.tabIndex = 2;
    button.append(document.createElement("button"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    validateButtons();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("positive tabindex"),
      button,
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/nested interactive/i),
      button,
    );
  });

  it("warns when data-native-button does not match the element", () => {
    const button = createButton();
    button.textContent = "Broken";
    button.setAttribute("data-native-button", "true");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    validateButtons();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("data-native-button"),
      button,
    );
  });
});

describe("button state controller", () => {
  it("uses native disabled semantics by default", () => {
    const button = document.createElement("button");
    button.setAttribute("data-ormo-button", "");

    setButtonState(button, { disabled: true, pending: true });

    expect(button.disabled).toBe(true);
    expect(button.hasAttribute("data-disabled")).toBe(true);
    expect(button.hasAttribute("data-ormo-button-disabled")).toBe(true);
    expect(button.hasAttribute("data-pending")).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.hasAttribute("aria-disabled")).toBe(false);

    setButtonState(button, { disabled: false, pending: false });

    expect(button.disabled).toBe(false);
    expect(button.hasAttribute("data-disabled")).toBe(false);
    expect(button.hasAttribute("data-ormo-button-disabled")).toBe(false);
    expect(button.hasAttribute("data-pending")).toBe(false);
    expect(button.hasAttribute("aria-busy")).toBe(false);
  });

  it("keeps a native disabled button focusable on request", () => {
    const button = document.createElement("button");
    button.setAttribute("data-ormo-button", "");
    document.body.append(button);
    const handleClick = vi.fn();
    button.addEventListener("click", handleClick);

    setButtonState(button, {
      disabled: true,
      focusableWhenDisabled: true,
    });
    button.click();

    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("data-focusable-when-disabled")).toBe(true);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("remembers focusableWhenDisabled across disabled-only updates", () => {
    const button = document.createElement("button");
    button.setAttribute("data-ormo-button", "");
    document.body.append(button);

    setButtonState(button, {
      disabled: true,
      focusableWhenDisabled: true,
    });
    setButtonState(button, { disabled: true });

    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("data-focusable-when-disabled")).toBe(true);

    setButtonState(button, { disabled: false });
    setButtonState(button, { disabled: true });

    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  it("restores a non-native button's tabindex", () => {
    const button = createButton();
    button.tabIndex = 3;

    setButtonState(button, { disabled: true });
    expect(button.tabIndex).toBe(-1);
    expect(button.getAttribute("aria-disabled")).toBe("true");

    setButtonState(button, { disabled: false });
    expect(button.tabIndex).toBe(3);
    expect(button.hasAttribute("aria-disabled")).toBe(false);
  });

  it("keeps a positive tabindex when disabling as focusable", () => {
    const button = createButton();
    button.tabIndex = 3;

    setButtonState(button, {
      disabled: true,
      focusableWhenDisabled: true,
    });

    expect(button.tabIndex).toBe(3);
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  it("forces focusability when an authored tabindex was -1", () => {
    const button = createButton();
    button.tabIndex = -1;

    setButtonState(button, {
      disabled: true,
      focusableWhenDisabled: true,
    });

    expect(button.tabIndex).toBe(0);
  });

  it("restores default focusability after server-rendered disabled state", () => {
    const button = createButton({ disabled: true });

    setButtonState(button, { disabled: false });

    expect(button.tabIndex).toBe(0);
  });

  it("preserves SSR tabindex state across redundant disabled updates", () => {
    const button = createButton({ disabled: true });
    button.setAttribute("data-ormo-button-tabindex", "3");

    setButtonState(button, { disabled: true });
    setButtonState(button, { disabled: false });

    expect(button.getAttribute("tabindex")).toBe("3");
  });

  it("restores a negative tabindex after temporary disabled focusability", () => {
    const button = createButton();
    button.tabIndex = -1;

    setButtonState(button, {
      disabled: true,
      focusableWhenDisabled: true,
    });
    expect(button.tabIndex).toBe(0);

    setButtonState(button, { disabled: false });
    expect(button.tabIndex).toBe(-1);

    setButtonState(button, { disabled: false });
    expect(button.tabIndex).toBe(-1);
  });

  it("restores the lexical form of an authored tabindex", () => {
    const button = createButton();
    button.setAttribute("tabindex", "02");

    setButtonState(button, { disabled: true });
    setButtonState(button, { disabled: false });

    expect(button.getAttribute("tabindex")).toBe("02");
  });

  it("cancels an active Space press when disabled", () => {
    const button = createButton();
    const handleClick = vi.fn();
    button.addEventListener("click", handleClick);

    pressKey(button, "keydown", " ");
    setButtonState(button, { disabled: true });
    setButtonState(button, { disabled: false });
    pressKey(button, "keyup", " ");

    expect(handleClick).not.toHaveBeenCalled();
  });

  it("blocks submit events from an internally disabled submitter", () => {
    const form = document.createElement("form");
    const button = document.createElement("button");
    button.type = "submit";
    button.setAttribute("data-ormo-button", "");
    button.setAttribute("aria-disabled", "true");
    form.append(button);
    document.body.append(form);

    setButtonState(button, {
      disabled: true,
      focusableWhenDisabled: true,
    });

    const handleSubmit = vi.fn((event: Event) => event.preventDefault());
    form.addEventListener("submit", handleSubmit);

    const submitted = form.dispatchEvent(
      new SubmitEvent("submit", {
        bubbles: true,
        cancelable: true,
        submitter: button,
      }),
    );

    expect(submitted).toBe(false);
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("rejects elements that are not Ormo buttons", () => {
    expect(() =>
      setButtonState(document.createElement("button"), { disabled: true }),
    ).toThrow("expects an Ormo Button");
  });
});
