import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AlertDialogOpenChangeEvent,
  OrmoAlertDialogElement,
} from "../../src/components/alert-dialog/types";
import "../../src/runtime/alert-dialog";

interface AlertDialogParts {
  root: OrmoAlertDialogElement;
  trigger: HTMLButtonElement;
  content: HTMLDialogElement;
  title: HTMLHeadingElement;
  description: HTMLParagraphElement;
  cancel: HTMLButtonElement;
  action: HTMLButtonElement;
}

function createAlertDialog(): AlertDialogParts {
  const root = document.createElement("ormo-alert-dialog");
  root.innerHTML = `
    <button type="button" data-ormo-alert-dialog-trigger>Delete project</button>
    <dialog role="alertdialog" aria-modal="true" data-ormo-alert-dialog-content>
      <h2 data-ormo-alert-dialog-title>Delete project?</h2>
      <p data-ormo-alert-dialog-description>This cannot be undone.</p>
      <button type="button" value="cancel" data-ormo-alert-dialog-cancel>Cancel</button>
      <button type="button" value="delete" data-ormo-alert-dialog-action>Delete</button>
    </dialog>
  `;
  document.body.append(root);

  return {
    root,
    trigger: root.querySelector("[data-ormo-alert-dialog-trigger]")!,
    content: root.querySelector("[data-ormo-alert-dialog-content]")!,
    title: root.querySelector("[data-ormo-alert-dialog-title]")!,
    description: root.querySelector("[data-ormo-alert-dialog-description]")!,
    cancel: root.querySelector("[data-ormo-alert-dialog-cancel]")!,
    action: root.querySelector("[data-ormo-alert-dialog-action]")!,
  };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("alert dialog", () => {
  it("wires the accessible name, description, and trigger relationship", () => {
    const { root, trigger, content, title, description } = createAlertDialog();

    expect(content.getAttribute("role")).toBe("alertdialog");
    expect(content.getAttribute("aria-modal")).toBe("true");
    expect(content.getAttribute("aria-labelledby")).toBe(title.id);
    expect(content.getAttribute("aria-describedby")).toBe(description.id);
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger.getAttribute("aria-controls")).toBe(content.id);
    expect(root.dataset.state).toBe("closed");
    expect(content.dataset.state).toBe("closed");
  });

  it("opens modally, focuses Cancel, and exposes open state", () => {
    const { root, trigger, content, cancel } = createAlertDialog();
    const changes: AlertDialogOpenChangeEvent["detail"][] = [];
    root.addEventListener("ormo:alert-dialog-open-change", (event) => {
      changes.push((event as AlertDialogOpenChangeEvent).detail);
    });

    trigger.click();

    expect(content.open).toBe(true);
    expect(root.open).toBe(true);
    expect(document.activeElement).toBe(cancel);
    expect(root.hasAttribute("data-open")).toBe(true);
    expect(content.hasAttribute("data-open")).toBe(true);
    expect(trigger.hasAttribute("data-open")).toBe(true);
    expect(
      document.documentElement.hasAttribute("data-ormo-scroll-locked"),
    ).toBe(true);
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(changes).toEqual([
      { open: true, reason: "trigger", returnValue: "" },
    ]);
  });

  it("closes from Cancel and restores focus to the trigger", () => {
    const { root, trigger, content, cancel } = createAlertDialog();
    const changes: AlertDialogOpenChangeEvent["detail"][] = [];
    root.addEventListener("ormo:alert-dialog-open-change", (event) => {
      changes.push((event as AlertDialogOpenChangeEvent).detail);
    });

    trigger.click();
    cancel.click();

    expect(content.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(
      document.documentElement.hasAttribute("data-ormo-scroll-locked"),
    ).toBe(false);
    expect(root.dataset.state).toBe("closed");
    expect(changes.at(-1)).toEqual({
      open: false,
      reason: "cancel",
      returnValue: "cancel",
    });
  });

  it("reports an action and its return value", () => {
    const { root, trigger, action } = createAlertDialog();
    const listener = vi.fn();
    root.addEventListener("ormo:alert-dialog-open-change", listener);

    trigger.click();
    action.click();

    const event = listener.mock.calls.at(-1)?.[0] as AlertDialogOpenChangeEvent;
    expect(event.detail).toEqual({
      open: false,
      reason: "action",
      returnValue: "delete",
    });
  });

  it("allows a consumer to prevent an action from closing the dialog", () => {
    const { trigger, content, action } = createAlertDialog();
    action.addEventListener("click", (event) => event.preventDefault());

    trigger.click();
    action.click();

    expect(content.open).toBe(true);
  });

  it("waits for an uncancelled submit Action before closing", async () => {
    const { root, trigger, content, action } = createAlertDialog();
    const form = document.createElement("form");
    action.type = "submit";
    content.append(form);
    form.append(action);
    trigger.click();

    form.addEventListener("submit", (event) => event.preventDefault(), {
      once: true,
    });
    form.dispatchEvent(
      new SubmitEvent("submit", {
        bubbles: true,
        cancelable: true,
        submitter: action,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(content.open).toBe(true);

    form.dispatchEvent(
      new SubmitEvent("submit", {
        bubbles: true,
        cancelable: true,
        submitter: action,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(root.open).toBe(false);
    expect(content.returnValue).toBe("delete");
  });

  it("reports Escape when the native cancel action closes the dialog", () => {
    const { root, trigger, content } = createAlertDialog();
    const listener = vi.fn();
    root.addEventListener("ormo:alert-dialog-open-change", listener);
    trigger.click();

    content.dispatchEvent(new Event("cancel", { cancelable: true }));
    content.close();

    const event = listener.mock.calls.at(-1)?.[0] as AlertDialogOpenChangeEvent;
    expect(event.detail.reason).toBe("escape");
  });

  it("supports framework-independent programmatic control", () => {
    const { root, content } = createAlertDialog();
    const invoker = document.createElement("button");
    const listener = vi.fn();
    root.addEventListener("ormo:alert-dialog-open-change", listener);
    document.body.prepend(invoker);
    invoker.focus();

    root.showModal();
    expect(root.open).toBe(true);
    expect(
      (listener.mock.calls[0]?.[0] as AlertDialogOpenChangeEvent).detail.reason,
    ).toBe("programmatic");

    root.close("complete");
    expect(content.returnValue).toBe("complete");
    expect(root.open).toBe(false);
    expect(document.activeElement).toBe(invoker);
  });

  it("allows autofocus to override the default Cancel focus", () => {
    const { trigger, action } = createAlertDialog();
    action.setAttribute("autofocus", "");

    trigger.click();

    expect(document.activeElement).toBe(action);
  });

  it("keeps a programmatic initial focus target out of the Tab sequence", () => {
    const { trigger, content, title, cancel, action } = createAlertDialog();
    title.tabIndex = -1;
    title.setAttribute("autofocus", "");

    trigger.click();
    expect(document.activeElement).toBe(title);

    action.focus();
    action.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Tab",
      }),
    );

    expect(document.activeElement).toBe(cancel);
    expect(content.open).toBe(true);
  });

  it("restores focus to an explicit selector target", () => {
    const { root, trigger, content, action } = createAlertDialog();
    const destination = document.createElement("button");
    destination.id = "after-delete";
    document.body.append(destination);
    content.dataset.finalFocus = "#after-delete";

    trigger.click();
    action.click();

    expect(document.activeElement).toBe(destination);
    expect(root.open).toBe(false);
  });

  it("restores focus to an explicit DOM element", () => {
    const { root, trigger, action } = createAlertDialog();
    const destination = document.createElement("div");
    destination.tabIndex = -1;
    document.body.append(destination);
    root.finalFocus = destination;

    trigger.click();
    action.click();

    expect(document.activeElement).toBe(destination);
  });

  it("does not open from a disabled trigger", () => {
    const { trigger, content } = createAlertDialog();
    trigger.disabled = true;

    trigger.click();

    expect(content.open).toBe(false);
  });

  it("preserves authored accessible relationships", () => {
    const root = document.createElement("ormo-alert-dialog");
    root.innerHTML = `
      <dialog
        data-ormo-alert-dialog-content
        aria-label="Authored name"
        aria-describedby="authored-description"
      >
        <h2 data-ormo-alert-dialog-title>Generated title</h2>
        <p id="authored-description">Authored description</p>
        <button data-ormo-alert-dialog-action>Continue</button>
      </dialog>
    `;
    document.body.append(root);
    const content = root.querySelector<HTMLDialogElement>(
      "[data-ormo-alert-dialog-content]",
    )!;

    expect(content.getAttribute("aria-label")).toBe("Authored name");
    expect(content.hasAttribute("aria-labelledby")).toBe(false);
    expect(content.getAttribute("aria-describedby")).toBe(
      "authored-description",
    );
  });

  it("updates generated relationships when part ids change", async () => {
    const { content, title, description } = createAlertDialog();

    title.id = "updated-alert-title";
    description.id = "updated-alert-description";

    await vi.waitFor(() => {
      expect(content.getAttribute("aria-labelledby")).toBe(
        "updated-alert-title",
      );
      expect(content.getAttribute("aria-describedby")).toBe(
        "updated-alert-description",
      );
    });
  });

  it("reconciles an authored aria-label added and removed at runtime", async () => {
    const { content, title } = createAlertDialog();

    content.setAttribute("aria-label", "Authored alert name");
    await vi.waitFor(() => {
      expect(content.hasAttribute("aria-labelledby")).toBe(false);
    });

    content.removeAttribute("aria-label");
    await vi.waitFor(() => {
      expect(content.getAttribute("aria-labelledby")).toBe(title.id);
    });
  });

  it("removes generated relationships when their parts are removed", async () => {
    const { content, title, description } = createAlertDialog();

    title.remove();
    description.remove();
    await vi.waitFor(() => {
      expect(content.hasAttribute("aria-labelledby")).toBe(false);
      expect(content.hasAttribute("aria-describedby")).toBe(false);
    });
  });

  it("warns in development when its name and description are missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const root = document.createElement("ormo-alert-dialog");
    root.innerHTML = `
      <dialog data-ormo-alert-dialog-content>
        <button data-ormo-alert-dialog-action>Continue</button>
      </dialog>
    `;

    document.body.append(root);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("AlertDialog.Title"),
      root,
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("AlertDialog.Description"),
      root,
    );
  });

  it("does not dismiss from a click on the dialog backdrop", () => {
    const { trigger, content } = createAlertDialog();
    trigger.click();

    content.click();

    expect(content.open).toBe(true);
  });

  it("wraps Tab focus within the dialog", () => {
    const { trigger, cancel, action } = createAlertDialog();
    trigger.click();

    action.focus();
    action.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Tab",
      }),
    );
    expect(document.activeElement).toBe(cancel);

    cancel.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Tab",
        shiftKey: true,
      }),
    );
    expect(document.activeElement).toBe(action);
  });

  it("exposes transition lifecycle attributes", () => {
    const { trigger, content, action } = createAlertDialog();

    trigger.click();
    expect(content.hasAttribute("data-starting-style")).toBe(true);

    action.click();
    expect(content.hasAttribute("data-starting-style")).toBe(false);
    expect(content.hasAttribute("data-ending-style")).toBe(true);
  });

  it("closes before an Astro document swap", () => {
    const { root, trigger, content } = createAlertDialog();
    trigger.click();

    document.dispatchEvent(new Event("astro:before-swap"));

    expect(root.open).toBe(false);
    expect(content.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it("supports a nested alert dialog without closing its parent", () => {
    const { root, trigger, content, cancel } = createAlertDialog();
    const child = document.createElement("ormo-alert-dialog");
    child.innerHTML = `
      <button type="button" data-ormo-alert-dialog-trigger>Open nested alert</button>
      <dialog data-ormo-alert-dialog-content>
        <h2 data-ormo-alert-dialog-title>Nested alert</h2>
        <p data-ormo-alert-dialog-description>Confirm the nested action.</p>
        <button type="button" data-ormo-alert-dialog-cancel>Keep editing</button>
      </dialog>
    `;
    content.append(child);
    const childTrigger = child.querySelector<HTMLButtonElement>(
      "[data-ormo-alert-dialog-trigger]",
    )!;
    const childContent = child.querySelector<HTMLDialogElement>(
      "[data-ormo-alert-dialog-content]",
    )!;
    const childCancel = child.querySelector<HTMLButtonElement>(
      "[data-ormo-alert-dialog-cancel]",
    )!;

    trigger.click();
    childTrigger.click();

    expect(root.open).toBe(true);
    expect(child.open).toBe(true);
    expect(document.activeElement).toBe(childCancel);

    childCancel.click();

    expect(root.open).toBe(true);
    expect(child.open).toBe(false);
    expect(childContent.open).toBe(false);
    expect(document.activeElement).toBe(childTrigger);

    cancel.click();
    expect(root.open).toBe(false);
  });

  it("opens from a detached trigger and restores focus to it", async () => {
    const { root, trigger, content, cancel } = createAlertDialog();
    const detachedTrigger = document.createElement("button");
    detachedTrigger.type = "button";
    detachedTrigger.textContent = "Detached trigger";
    detachedTrigger.setAttribute("data-ormo-alert-dialog-trigger", "");
    detachedTrigger.setAttribute("data-ormo-alert-dialog-for", root.id);
    document.body.prepend(detachedTrigger);

    await vi.waitFor(() => {
      expect(detachedTrigger.getAttribute("aria-controls")).toBe(content.id);
    });

    detachedTrigger.click();

    expect(root.open).toBe(true);
    expect(detachedTrigger.dataset.state).toBe("open");
    expect(detachedTrigger.hasAttribute("data-open")).toBe(true);
    expect(trigger.dataset.state).toBe("open");
    expect(document.activeElement).toBe(cancel);

    cancel.click();

    expect(root.open).toBe(false);
    expect(detachedTrigger.dataset.state).toBe("closed");
    expect(document.activeElement).toBe(detachedTrigger);
  });

  it("supports multiple detached triggers for one Root", async () => {
    const { root, content, action } = createAlertDialog();
    const triggers = ["First detached trigger", "Second detached trigger"].map(
      (label) => {
        const trigger = document.createElement("button");
        trigger.textContent = label;
        trigger.setAttribute("data-ormo-alert-dialog-trigger", "");
        trigger.setAttribute("data-ormo-alert-dialog-for", root.id);
        document.body.prepend(trigger);
        return trigger;
      },
    );

    await vi.waitFor(() => {
      expect(
        triggers.every(
          (trigger) => trigger.getAttribute("aria-controls") === content.id,
        ),
      ).toBe(true);
    });

    triggers[1]!.click();
    action.click();

    expect(document.activeElement).toBe(triggers[1]);
    expect(
      triggers.every((trigger) => trigger.dataset.state === "closed"),
    ).toBe(true);
  });

  it("ignores detached triggers whose target does not exist", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { root, content } = createAlertDialog();
    const trigger = document.createElement("button");
    trigger.setAttribute("data-ormo-alert-dialog-trigger", "");
    trigger.setAttribute("data-ormo-alert-dialog-for", "missing-dialog");
    document.body.prepend(trigger);

    trigger.click();

    expect(root.open).toBe(false);
    expect(content.open).toBe(false);
    expect(trigger.hasAttribute("aria-controls")).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("must match an AlertDialog.Root id"),
      trigger,
    );
  });

  it("restores authored trigger attributes when a detached trigger is retargeted", async () => {
    const { root, content } = createAlertDialog();
    const trigger = document.createElement("button");
    trigger.setAttribute("data-ormo-alert-dialog-trigger", "");
    trigger.setAttribute("data-ormo-alert-dialog-for", root.id);
    trigger.setAttribute("aria-controls", "authored-content");
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.dataset.state = "authored";
    document.body.prepend(trigger);

    await vi.waitFor(() => {
      expect(trigger.getAttribute("aria-controls")).toBe(content.id);
    });

    trigger.setAttribute("data-ormo-alert-dialog-for", "missing-dialog");

    await vi.waitFor(() => {
      expect(trigger.getAttribute("aria-controls")).toBe("authored-content");
      expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
      expect(trigger.dataset.state).toBe("authored");
    });
  });

  it("normalizes state and focus if open Content is removed", async () => {
    const { root, trigger, content } = createAlertDialog();
    const listener = vi.fn();
    root.addEventListener("ormo:alert-dialog-open-change", listener);
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

    const event = listener.mock.calls.at(-1)?.[0] as AlertDialogOpenChangeEvent;
    expect(event.detail).toEqual({
      open: false,
      reason: "programmatic",
      returnValue: "",
    });
  });

  it("closes and clears transition state when disconnected", () => {
    const { root, trigger, content } = createAlertDialog();
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
