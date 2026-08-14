import { afterEach, describe, expect, it, vi } from "vitest";
import { setTogglePressed, validateToggles } from "../../src/runtime/toggle";

function create(controlled = false): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.ormoToggle = "";
  button.setAttribute("aria-pressed", "false");
  button.dataset.state = "off";
  button.toggleAttribute("data-controlled", controlled);
  document.body.append(button);
  return button;
}

afterEach(() => document.body.replaceChildren());

describe("Toggle runtime", () => {
  it("updates uncontrolled state and emits a cancellable request", () => {
    const button = create();
    const listener = vi.fn();
    button.addEventListener("ormo:pressed-change", listener);
    button.click();
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.dataset.state).toBe("on");
    expect(listener.mock.calls[0]?.[0].cancelable).toBe(true);
  });

  it("waits for controlled state and respects cancellation", () => {
    const controlled = create(true);
    controlled.click();
    expect(controlled.getAttribute("aria-pressed")).toBe("false");
    setTogglePressed(controlled, true);
    expect(controlled.getAttribute("aria-pressed")).toBe("true");
    controlled.addEventListener("ormo:pressed-change", (event) =>
      event.preventDefault(),
    );
    controlled.click();
    expect(controlled.getAttribute("aria-pressed")).toBe("true");
  });

  it("preserves native disabled and form behaviour", () => {
    const button = create();
    button.disabled = true;
    button.type = "submit";
    button.name = "action";
    button.click();
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.type).toBe("submit");
    expect(button.name).toBe("action");
  });

  it("synchronises dynamic native state hooks", async () => {
    const button = create();
    button.disabled = true;
    button.setAttribute("aria-pressed", "true");
    await Promise.resolve();
    expect(button.hasAttribute("data-disabled")).toBe(true);
    expect(button.dataset.state).toBe("on");
  });

  it("warns when an accessible name is missing", () => {
    const button = create();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    validateToggles(document);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("accessible name"),
      button,
    );
  });
});
