import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  OrmoPopoverElement,
  PopoverOpenChangeEvent,
} from "../../src/components/popover/types";
import "../../src/runtime/popover";

interface PopoverParts {
  root: OrmoPopoverElement;
  trigger: HTMLButtonElement;
  content: HTMLElement;
  title: HTMLHeadingElement;
  description: HTMLParagraphElement;
  input: HTMLInputElement;
  close: HTMLButtonElement;
}

function installPopoverPolyfill(content: HTMLElement): void {
  let open = false;

  Object.defineProperty(content, "matches", {
    configurable: true,
    value(selectors: string) {
      if (selectors === ":popover-open") {
        return open;
      }
      return HTMLElement.prototype.matches.call(this, selectors);
    },
  });

  Object.assign(content, {
    showPopover(options?: { source?: Element }) {
      if (open) return;
      const before = new Event("beforetoggle", {
        bubbles: true,
        cancelable: true,
      });
      Object.assign(before, { oldState: "closed", newState: "open" });
      content.dispatchEvent(before);
      open = true;
      content.toggleAttribute("data-open", true);
      const toggle = new Event("toggle", { bubbles: true });
      Object.assign(toggle, {
        oldState: "closed",
        newState: "open",
        source: options?.source,
      });
      content.dispatchEvent(toggle);
    },
    hidePopover() {
      if (!open) return;
      const before = new Event("beforetoggle", {
        bubbles: true,
        cancelable: true,
      });
      Object.assign(before, { oldState: "open", newState: "closed" });
      content.dispatchEvent(before);
      open = false;
      content.toggleAttribute("data-open", false);
      const toggle = new Event("toggle", { bubbles: true });
      Object.assign(toggle, { oldState: "open", newState: "closed" });
      content.dispatchEvent(toggle);
    },
  });
}

function createPopover(options?: {
  disablePointerDismissal?: boolean;
  positioning?: "floating";
}): PopoverParts {
  const root = document.createElement("ormo-popover") as OrmoPopoverElement;
  if (options?.disablePointerDismissal) {
    root.setAttribute("data-disable-pointer-dismissal", "");
  }
  if (options?.positioning === "floating") {
    root.setAttribute("data-positioning", "floating");
  }
  root.innerHTML = `
    <button type="button" data-ormo-popover-trigger aria-haspopup="dialog" aria-expanded="false">
      Filters
    </button>
    <div
      role="dialog"
      popover="auto"
      tabindex="-1"
      data-side="bottom"
      data-align="center"
      data-ormo-popover-content
      style="--ormo-popover-side-offset: 8px"
    >
      <h2 data-ormo-popover-title>Filters</h2>
      <p data-ormo-popover-description>Narrow the results.</p>
      <input aria-label="Keyword" />
      <button type="button" value="done" data-ormo-popover-close>Done</button>
    </div>
  `;
  document.body.append(root);

  const content = root.querySelector<HTMLElement>(
    "[data-ormo-popover-content]",
  )!;
  installPopoverPolyfill(content);

  // connectedCallback may have run before polyfill; re-prepare by reconnecting.
  root.remove();
  document.body.append(root);

  return {
    root,
    trigger: root.querySelector("[data-ormo-popover-trigger]")!,
    content,
    title: root.querySelector("[data-ormo-popover-title]")!,
    description: root.querySelector("[data-ormo-popover-description]")!,
    input: root.querySelector("input")!,
    close: root.querySelector("[data-ormo-popover-close]")!,
  };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  delete (globalThis as { __ormoPopoverFloatingPositioner?: unknown })
    .__ormoPopoverFloatingPositioner;
});

describe("popover", () => {
  it("wires non-modal dialog semantics, name, description, and trigger", () => {
    const { root, trigger, content, title, description } = createPopover();

    expect(content.getAttribute("role")).toBe("dialog");
    expect(content.getAttribute("aria-modal")).toBeNull();
    expect(content.getAttribute("aria-labelledby")).toBe(title.id);
    expect(content.getAttribute("aria-describedby")).toBe(description.id);
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger.getAttribute("aria-controls")).toBe(content.id);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(root.dataset.state).toBe("closed");
    expect(content.dataset.side).toBe("bottom");
    expect(content.dataset.align).toBe("center");
  });

  it("opens, focuses the first tabbable element, and does not lock scroll", () => {
    const { root, trigger, content, input } = createPopover();
    const changes: PopoverOpenChangeEvent["detail"][] = [];
    root.addEventListener("ormo:popover-open-change", (event) => {
      changes.push((event as PopoverOpenChangeEvent).detail);
    });

    trigger.click();

    expect(root.open).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(root.hasAttribute("data-open")).toBe(true);
    expect(trigger.dataset.state).toBe("open");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(
      document.documentElement.hasAttribute("data-ormo-scroll-locked"),
    ).toBe(false);
    expect(changes).toEqual([
      { open: true, reason: "trigger", returnValue: "" },
    ]);
    expect(content.getAttribute("popover")).toBe("auto");
  });

  it("closes from Close, reports its value, and restores trigger focus", () => {
    const { root, trigger, close } = createPopover();
    const listener = vi.fn();
    root.addEventListener("ormo:popover-open-change", listener);

    trigger.click();
    close.click();

    expect(root.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(
      (listener.mock.calls.at(-1)?.[0] as PopoverOpenChangeEvent).detail,
    ).toEqual({ open: false, reason: "close", returnValue: "done" });
  });

  it("toggles closed from the same trigger", () => {
    const { root, trigger } = createPopover();
    trigger.click();
    expect(root.open).toBe(true);
    trigger.click();
    expect(root.open).toBe(false);
  });

  it("supports programmatic show, hide, and toggle", () => {
    const { root, trigger } = createPopover();
    const changes: PopoverOpenChangeEvent["detail"][] = [];
    root.addEventListener("ormo:popover-open-change", (event) => {
      changes.push((event as PopoverOpenChangeEvent).detail);
    });

    root.show();
    expect(root.open).toBe(true);
    root.hide("saved");
    expect(root.open).toBe(false);
    root.toggle(true);
    expect(root.open).toBe(true);
    root.toggle();
    expect(root.open).toBe(false);

    expect(changes.map((detail) => detail.reason)).toEqual([
      "programmatic",
      "programmatic",
      "programmatic",
      "programmatic",
    ]);
    expect(document.activeElement === trigger || !root.open).toBe(true);
  });

  it("uses manual popover when pointer dismissal is disabled", () => {
    const { content, trigger, root } = createPopover({
      disablePointerDismissal: true,
    });

    trigger.click();
    expect(content.getAttribute("popover")).toBe("manual");
    expect(root.open).toBe(true);

    document.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        clientX: 1,
        clientY: 1,
      }),
    );
    expect(root.open).toBe(true);

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(root.open).toBe(false);
  });

  it("connects detached triggers and restores authored trigger styles", () => {
    const root = document.createElement("ormo-popover") as OrmoPopoverElement;
    root.id = "filters-popover";
    root.innerHTML = `
      <div role="dialog" popover="auto" tabindex="-1" data-ormo-popover-content>
        <h2 data-ormo-popover-title>Filters</h2>
        <button type="button" data-ormo-popover-close>Done</button>
      </div>
    `;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.setAttribute("data-ormo-popover-trigger", "");
    trigger.setAttribute("data-ormo-popover-for", "filters-popover");
    trigger.style.setProperty(
      "anchor-name",
      "--authored-popover-anchor",
      "important",
    );
    trigger.textContent = "Open filters";

    document.body.append(trigger, root);
    const content = root.querySelector<HTMLElement>(
      "[data-ormo-popover-content]",
    )!;
    installPopoverPolyfill(content);
    root.remove();
    document.body.append(root);

    expect(trigger.getAttribute("aria-controls")).toBe(content.id);

    trigger.click();
    expect(root.open).toBe(true);
    expect(document.activeElement).toBe(
      root.querySelector("[data-ormo-popover-close]"),
    );

    (
      root as OrmoPopoverElement & { disconnectedCallback(): void }
    ).disconnectedCallback();
    expect(trigger.style.getPropertyValue("anchor-name")).toBe(
      "--authored-popover-anchor",
    );
    expect(trigger.style.getPropertyPriority("anchor-name")).toBe("important");
  });

  it("warns when floating positioning is requested without the floating import", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    createPopover({ positioning: "floating" });

    expect(
      warn.mock.calls.some((call) =>
        String(call[0]).includes('positioning="floating"'),
      ),
    ).toBe(true);
  });

  it("applies the registered floating positioner across module instances", async () => {
    const { registerPopoverFloatingPositioner } =
      await import("../../src/runtime/popover");

    registerPopoverFloatingPositioner(({ content, side, align }) => {
      content.setAttribute("data-ormo-popover-positioning", "floating");
      content.style.left = "24px";
      content.style.top = "48px";
      content.style.position = "fixed";
      content.dataset.resolvedSide = side === "bottom" ? "top" : side;
      content.dataset.resolvedAlign = align;
      return () => {
        content.style.removeProperty("left");
        content.style.removeProperty("top");
      };
    });

    const { root, trigger, content } = createPopover({
      positioning: "floating",
    });
    content.dataset.side = "bottom";
    content.dataset.align = "start";
    content.style.right = "12px";
    content.style.position = "absolute";

    trigger.click();

    expect(content.getAttribute("data-ormo-popover-positioning")).toBe(
      "floating",
    );
    expect(content.dataset.side).toBe("bottom");
    expect(content.dataset.align).toBe("start");
    expect(content.dataset.resolvedSide).toBe("top");
    expect(content.dataset.resolvedAlign).toBe("start");
    expect(content.style.left).toBe("24px");
    expect(content.style.top).toBe("48px");

    root.hide();
    expect(content.getAttribute("data-ormo-popover-positioning")).toBeNull();
    expect(content.hasAttribute("data-resolved-side")).toBe(false);
    expect(content.hasAttribute("data-resolved-align")).toBe(false);
    expect(content.dataset.side).toBe("bottom");
    expect(content.style.left).toBe("");
    expect(content.style.top).toBe("");
    expect(content.style.right).toBe("12px");
    expect(content.style.position).toBe("absolute");
  });

  it("ignores stale floating updates after close", async () => {
    const { registerPopoverFloatingPositioner } =
      await import("../../src/runtime/popover");

    let finishUpdate: (() => void) | undefined;
    registerPopoverFloatingPositioner(({ content }) => {
      let active = true;
      void new Promise<void>((resolve) => {
        finishUpdate = resolve;
      }).then(() => {
        if (!active) return;
        content.style.left = "99px";
        content.dataset.resolvedSide = "left";
      });
      return () => {
        active = false;
      };
    });

    const { root, trigger, content } = createPopover({
      positioning: "floating",
    });

    trigger.click();
    root.hide();
    finishUpdate?.();
    await Promise.resolve();

    expect(content.style.left).toBe("");
    expect(content.hasAttribute("data-resolved-side")).toBe(false);
  });

  it("measures trigger size on open and clears metrics on close", () => {
    const { root, trigger, content } = createPopover();
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      bottom: 40,
      height: 32,
      left: 10,
      right: 130,
      top: 8,
      width: 120,
      x: 10,
      y: 8,
      toJSON: () => undefined,
    });

    trigger.click();

    expect(content.style.getPropertyValue("--ormo-popover-trigger-width")).toBe(
      "120px",
    );
    expect(
      content.style.getPropertyValue("--ormo-popover-trigger-height"),
    ).toBe("32px");

    root.hide();

    expect(content.style.getPropertyValue("--ormo-popover-trigger-width")).toBe(
      "",
    );
    expect(
      content.style.getPropertyValue("--ormo-popover-trigger-height"),
    ).toBe("");
  });

  it("allows a Close click to be prevented", () => {
    const { root, trigger, close } = createPopover();
    close.addEventListener("click", (event) => event.preventDefault());

    trigger.click();
    close.click();

    expect(root.open).toBe(true);
  });

  it("supports explicit final focus", () => {
    const { root } = createPopover();
    const destination = document.createElement("button");
    document.body.append(destination);
    root.finalFocus = destination;

    root.show();
    root.hide();

    expect(document.activeElement).toBe(destination);
  });

  it("honours autofocus on open", () => {
    const { trigger, title } = createPopover();
    title.tabIndex = -1;
    title.setAttribute("autofocus", "");

    trigger.click();
    expect(document.activeElement).toBe(title);
  });

  it("preserves authored accessible relationships", () => {
    const root = document.createElement("ormo-popover") as OrmoPopoverElement;
    root.innerHTML = `
      <button type="button" data-ormo-popover-trigger>Open</button>
      <div
        role="dialog"
        popover="auto"
        tabindex="-1"
        data-ormo-popover-content
        aria-label="Preferences"
        aria-describedby="custom-description"
      >
        <h2 data-ormo-popover-title>Generated title</h2>
        <p id="custom-description">Custom description</p>
        <button type="button" data-ormo-popover-close>Close</button>
      </div>
    `;
    document.body.append(root);
    const content = root.querySelector<HTMLElement>(
      "[data-ormo-popover-content]",
    )!;
    installPopoverPolyfill(content);
    root.remove();
    document.body.append(root);

    expect(content.getAttribute("aria-label")).toBe("Preferences");
    expect(content.hasAttribute("aria-labelledby")).toBe(false);
    expect(content.getAttribute("aria-describedby")).toBe("custom-description");
  });

  it("allows Description to be omitted", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const root = document.createElement("ormo-popover") as OrmoPopoverElement;
    root.innerHTML = `
      <button type="button" data-ormo-popover-trigger>Open</button>
      <div role="dialog" popover="auto" tabindex="-1" data-ormo-popover-content>
        <h2 data-ormo-popover-title>Shortcuts</h2>
        <button type="button" data-ormo-popover-close>Close</button>
      </div>
    `;
    document.body.append(root);
    const content = root.querySelector<HTMLElement>(
      "[data-ormo-popover-content]",
    )!;
    installPopoverPolyfill(content);
    root.remove();
    document.body.append(root);

    expect(warn).not.toHaveBeenCalled();
  });

  it("warns when its accessible name is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const root = document.createElement("ormo-popover") as OrmoPopoverElement;
    root.innerHTML = `
      <button type="button" data-ormo-popover-trigger>Open</button>
      <div role="dialog" popover="auto" tabindex="-1" data-ormo-popover-content>
        <button type="button" data-ormo-popover-close>Close</button>
      </div>
    `;
    document.body.append(root);
    const content = root.querySelector<HTMLElement>(
      "[data-ormo-popover-content]",
    )!;
    installPopoverPolyfill(content);
    root.remove();
    document.body.append(root);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Popover.Title"),
      root,
    );
  });

  it("warns when Close is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const root = document.createElement("ormo-popover") as OrmoPopoverElement;
    root.innerHTML = `
      <button type="button" data-ormo-popover-trigger>Open</button>
      <div role="dialog" popover="auto" tabindex="-1" data-ormo-popover-content>
        <h2 data-ormo-popover-title>Filters</h2>
      </div>
    `;
    document.body.append(root);
    const content = root.querySelector<HTMLElement>(
      "[data-ormo-popover-content]",
    )!;
    installPopoverPolyfill(content);
    root.remove();
    document.body.append(root);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Popover.Close"),
      root,
    );
  });

  it("ignores and diagnoses a detached trigger with no matching Root", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { content } = createPopover();
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.setAttribute("data-ormo-popover-trigger", "");
    trigger.setAttribute("data-ormo-popover-for", "missing-popover");
    document.body.append(trigger);

    trigger.click();

    expect(content.matches(":popover-open")).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("must match a Popover.Root id"),
      trigger,
    );
  });
});
