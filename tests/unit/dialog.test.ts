import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  DialogBeforeCloseEvent,
  DialogOpenChangeEvent,
  OrmoDialogElement,
} from "../../src/components/dialog/types";
import "../../src/runtime/dialog";

interface DialogParts {
  root: OrmoDialogElement;
  trigger: HTMLButtonElement;
  content: HTMLDialogElement;
  title: HTMLHeadingElement;
  description: HTMLParagraphElement;
  input: HTMLInputElement;
  close: HTMLButtonElement;
}

function createDialog(): DialogParts {
  const root = document.createElement("ormo-dialog");
  root.innerHTML = `
    <button type="button" data-ormo-dialog-trigger>Edit profile</button>
    <dialog role="dialog" aria-modal="true" data-ormo-dialog-content>
      <h2 data-ormo-dialog-title>Edit profile</h2>
      <p data-ormo-dialog-description>Change how your name appears.</p>
      <input aria-label="Display name" />
      <button type="button" value="done" data-ormo-dialog-close>Done</button>
    </dialog>
  `;
  document.body.append(root);

  return {
    root,
    trigger: root.querySelector("[data-ormo-dialog-trigger]")!,
    content: root.querySelector("[data-ormo-dialog-content]")!,
    title: root.querySelector("[data-ormo-dialog-title]")!,
    description: root.querySelector("[data-ormo-dialog-description]")!,
    input: root.querySelector("input")!,
    close: root.querySelector("[data-ormo-dialog-close]")!,
  };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("dialog", () => {
  it("wires modal semantics, its name, description, and trigger", () => {
    const { root, trigger, content, title, description } = createDialog();

    expect(content.getAttribute("role")).toBe("dialog");
    expect(content.getAttribute("aria-modal")).toBe("true");
    expect(content.getAttribute("aria-labelledby")).toBe(title.id);
    expect(content.getAttribute("aria-describedby")).toBe(description.id);
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger.getAttribute("aria-controls")).toBe(content.id);
    expect(root.dataset.state).toBe("closed");
  });

  it("opens modally, focuses the first tabbable element, and reports state", () => {
    const { root, trigger, content, input } = createDialog();
    const changes: DialogOpenChangeEvent["detail"][] = [];
    root.addEventListener("ormo:dialog-open-change", (event) => {
      changes.push((event as DialogOpenChangeEvent).detail);
    });

    trigger.click();

    expect(root.open).toBe(true);
    expect(content.open).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(root.hasAttribute("data-open")).toBe(true);
    expect(trigger.dataset.state).toBe("open");
    expect(
      document.documentElement.hasAttribute("data-ormo-scroll-locked"),
    ).toBe(true);
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(changes).toEqual([
      { open: true, reason: "trigger", returnValue: "" },
    ]);
  });

  it("closes from Close, reports its value, and restores trigger focus", () => {
    const { root, trigger, content, close } = createDialog();
    const listener = vi.fn();
    root.addEventListener("ormo:dialog-open-change", listener);

    trigger.click();
    close.click();

    expect(content.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(
      document.documentElement.hasAttribute("data-ormo-scroll-locked"),
    ).toBe(false);
    expect(
      (listener.mock.calls.at(-1)?.[0] as DialogOpenChangeEvent).detail,
    ).toEqual({ open: false, reason: "close", returnValue: "done" });
  });

  it("allows a Close click to be prevented", () => {
    const { trigger, content, close } = createDialog();
    close.addEventListener("click", (event) => event.preventDefault());

    trigger.click();
    close.click();

    expect(content.open).toBe(true);
  });

  it("allows user-requested dismissal to be cancelled with its reason", () => {
    const { root, trigger, content, close } = createDialog();
    const requests: DialogBeforeCloseEvent["detail"][] = [];
    root.addEventListener("ormo:dialog-before-close", (event) => {
      const request = event as DialogBeforeCloseEvent;
      requests.push(request.detail);
      request.preventDefault();
    });
    vi.spyOn(content, "getBoundingClientRect").mockReturnValue({
      bottom: 300,
      height: 200,
      left: 100,
      right: 400,
      top: 100,
      width: 300,
      x: 100,
      y: 100,
      toJSON: () => undefined,
    });
    trigger.click();

    close.click();
    expect(content.open).toBe(true);

    const outsideEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      clientX: 20,
      clientY: 20,
      detail: 1,
    });
    content.dispatchEvent(outsideEvent);
    expect(content.open).toBe(true);

    const escapeEvent = new Event("cancel", { cancelable: true });
    content.dispatchEvent(escapeEvent);
    expect(escapeEvent.defaultPrevented).toBe(true);
    expect(content.open).toBe(true);

    expect(requests.map(({ reason }) => reason)).toEqual([
      "close",
      "outside",
      "escape",
    ]);
    expect(requests[0]).toMatchObject({
      reason: "close",
      returnValue: "done",
    });
    expect(requests[1]?.originalEvent).toBe(outsideEvent);
    expect(requests[2]?.originalEvent).toBe(escapeEvent);
  });

  it("reports native Escape dismissal", () => {
    const { root, trigger, content } = createDialog();
    const listener = vi.fn();
    root.addEventListener("ormo:dialog-open-change", listener);
    trigger.click();

    content.dispatchEvent(new Event("cancel", { cancelable: true }));
    content.close();

    expect(
      (listener.mock.calls.at(-1)?.[0] as DialogOpenChangeEvent).detail.reason,
    ).toBe("escape");
  });

  it("dismisses from a pointer click outside the dialog bounds", () => {
    const { root, trigger, content } = createDialog();
    const listener = vi.fn();
    root.addEventListener("ormo:dialog-open-change", listener);
    vi.spyOn(content, "getBoundingClientRect").mockReturnValue({
      bottom: 300,
      height: 200,
      left: 100,
      right: 400,
      top: 100,
      width: 300,
      x: 100,
      y: 100,
      toJSON: () => undefined,
    });
    trigger.click();

    content.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        clientX: 20,
        clientY: 20,
        detail: 1,
      }),
    );

    expect(content.open).toBe(false);
    expect(
      (listener.mock.calls.at(-1)?.[0] as DialogOpenChangeEvent).detail.reason,
    ).toBe("outside");
  });

  it("does not dismiss from its surface or when pointer dismissal is disabled", () => {
    const { root, trigger, content } = createDialog();
    vi.spyOn(content, "getBoundingClientRect").mockReturnValue({
      bottom: 300,
      height: 200,
      left: 100,
      right: 400,
      top: 100,
      width: 300,
      x: 100,
      y: 100,
      toJSON: () => undefined,
    });
    trigger.click();
    content.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        clientX: 200,
        clientY: 200,
        detail: 1,
      }),
    );
    expect(content.open).toBe(true);

    root.setAttribute("data-disable-pointer-dismissal", "");
    content.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        clientX: 20,
        clientY: 20,
        detail: 1,
      }),
    );
    expect(content.open).toBe(true);
  });

  it("supports programmatic control and explicit final focus", () => {
    const { root, content } = createDialog();
    const destination = document.createElement("button");
    document.body.append(destination);
    root.finalFocus = destination;

    root.showModal();
    root.close("saved");

    expect(root.open).toBe(false);
    expect(content.returnValue).toBe("saved");
    expect(document.activeElement).toBe(destination);
  });

  it("honours autofocus and keeps a programmatic target out of Tab order", () => {
    const { trigger, title, input, close } = createDialog();
    title.tabIndex = -1;
    title.setAttribute("autofocus", "");

    trigger.click();
    expect(document.activeElement).toBe(title);

    close.focus();
    close.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Tab",
      }),
    );
    expect(document.activeElement).toBe(input);
  });

  it("preserves authored accessible relationships", () => {
    const root = document.createElement("ormo-dialog");
    root.innerHTML = `
      <dialog data-ormo-dialog-content aria-label="Preferences" aria-describedby="custom-description">
        <h2 data-ormo-dialog-title>Generated title</h2>
        <p id="custom-description">Custom description</p>
        <button data-ormo-dialog-close>Close</button>
      </dialog>
    `;
    document.body.append(root);
    const content = root.querySelector<HTMLDialogElement>(
      "[data-ormo-dialog-content]",
    )!;

    expect(content.getAttribute("aria-label")).toBe("Preferences");
    expect(content.hasAttribute("aria-labelledby")).toBe(false);
    expect(content.getAttribute("aria-describedby")).toBe("custom-description");
  });

  it("reconciles generated and authored relationships at runtime", async () => {
    const { content, title, description } = createDialog();

    title.id = "updated-dialog-title";
    description.id = "updated-dialog-description";
    await vi.waitFor(() => {
      expect(content.getAttribute("aria-labelledby")).toBe(title.id);
      expect(content.getAttribute("aria-describedby")).toBe(description.id);
    });

    content.setAttribute("aria-label", "Runtime preferences");
    content.setAttribute("aria-describedby", "authored-description");
    await vi.waitFor(
      () => {
        expect(content.hasAttribute("aria-labelledby")).toBe(false);
        expect(content.getAttribute("aria-describedby")).toBe(
          "authored-description",
        );
      },
      { timeout: 3000 },
    );

    content.removeAttribute("aria-label");
    content.removeAttribute("aria-describedby");
    await vi.waitFor(() => {
      expect(content.getAttribute("aria-labelledby")).toBe(title.id);
      expect(content.getAttribute("aria-describedby")).toBe(description.id);
    });
  });

  it("allows Description to be omitted for structured content", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const root = document.createElement("ormo-dialog");
    root.innerHTML = `
      <dialog data-ormo-dialog-content>
        <h2 data-ormo-dialog-title>Keyboard shortcuts</h2>
        <ul><li>Save</li></ul>
        <button data-ormo-dialog-close>Close</button>
      </dialog>
    `;
    document.body.append(root);

    expect(warn).not.toHaveBeenCalled();
  });

  it("warns when its accessible name or visible Close is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const root = document.createElement("ormo-dialog");
    root.innerHTML = `<dialog data-ormo-dialog-content></dialog>`;
    document.body.append(root);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Dialog.Title"),
      root,
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Dialog.Close"),
      root,
    );
  });

  it("supports detached triggers and restores focus to the exact invoker", async () => {
    const { root, trigger, content, close } = createDialog();
    const detached = document.createElement("button");
    detached.setAttribute("data-ormo-dialog-trigger", "");
    detached.setAttribute("data-ormo-dialog-for", root.id);
    document.body.prepend(detached);

    await vi.waitFor(() => {
      expect(detached.getAttribute("aria-controls")).toBe(content.id);
    });
    detached.click();
    expect(trigger.dataset.state).toBe("open");
    close.click();

    expect(document.activeElement).toBe(detached);
    expect(trigger.dataset.state).toBe("closed");
  });

  it("ignores and diagnoses a detached trigger with no matching Root", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { content } = createDialog();
    const trigger = document.createElement("button");
    trigger.setAttribute("data-ormo-dialog-trigger", "");
    trigger.setAttribute("data-ormo-dialog-for", "missing-dialog");
    document.body.append(trigger);

    trigger.click();

    expect(content.open).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("must match a Dialog.Root id"),
      trigger,
    );
  });

  it("keeps a nested parent open when its child closes", () => {
    const { root, trigger, content } = createDialog();
    const child = document.createElement("ormo-dialog");
    child.innerHTML = `
      <button data-ormo-dialog-trigger>Open child</button>
      <dialog data-ormo-dialog-content>
        <h2 data-ormo-dialog-title>Child</h2>
        <button data-ormo-dialog-close>Close child</button>
      </dialog>
    `;
    content.append(child);
    const childTrigger = child.querySelector<HTMLButtonElement>(
      "[data-ormo-dialog-trigger]",
    )!;
    const childClose = child.querySelector<HTMLButtonElement>(
      "[data-ormo-dialog-close]",
    )!;

    trigger.click();
    childTrigger.click();
    childClose.click();

    expect(root.open).toBe(true);
    expect(child.open).toBe(false);
    expect(document.activeElement).toBe(childTrigger);
  });

  it("normalizes state and focus if open Content is removed", async () => {
    const { root, trigger, content } = createDialog();
    const listener = vi.fn();
    root.addEventListener("ormo:dialog-open-change", listener);
    trigger.click();

    content.remove();

    await vi.waitFor(() => {
      expect(root.open).toBe(false);
      expect(root.dataset.state).toBe("closed");
      expect(root.hasAttribute("data-open")).toBe(false);
      expect(trigger.dataset.state).toBeUndefined();
      expect(trigger.hasAttribute("aria-controls")).toBe(false);
      expect(document.activeElement).toBe(trigger);
      expect(
        document.documentElement.hasAttribute("data-ormo-scroll-locked"),
      ).toBe(false);
      expect(document.documentElement.style.overflow).toBe("");
    });

    expect(
      (listener.mock.calls.at(-1)?.[0] as DialogOpenChangeEvent).detail,
    ).toEqual({
      open: false,
      reason: "programmatic",
      returnValue: "",
    });
  });

  it("closes and clears transition state when disconnected", () => {
    const { root, trigger, content } = createDialog();
    trigger.click();

    expect(content.open).toBe(true);
    expect(content.hasAttribute("data-starting-style")).toBe(true);

    root.remove();

    expect(content.open).toBe(false);
    expect(content.hasAttribute("data-starting-style")).toBe(false);
    expect(content.hasAttribute("data-ending-style")).toBe(false);
    expect(root.dataset.state).toBe("closed");
    expect(root.hasAttribute("data-open")).toBe(false);
    expect(
      document.documentElement.hasAttribute("data-ormo-scroll-locked"),
    ).toBe(false);

    document.body.append(root);
    expect(content.open).toBe(false);
    expect(root.dataset.state).toBe("closed");
  });
});
