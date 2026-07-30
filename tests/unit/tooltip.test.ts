import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  OrmoTooltipElement,
  TooltipOpenChangeEvent,
} from "../../src/components/tooltip/types";
import "../../src/runtime/tooltip";

interface TooltipParts {
  root: OrmoTooltipElement;
  trigger: HTMLButtonElement;
  content: HTMLElement;
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

function createTooltip(options?: {
  delay?: number;
  closeDelay?: number;
  disabled?: boolean;
  positioning?: "floating";
  contentHtml?: string;
}): TooltipParts {
  const root = document.createElement("ormo-tooltip") as OrmoTooltipElement;
  root.setAttribute("data-delay", String(options?.delay ?? 700));
  root.setAttribute("data-close-delay", String(options?.closeDelay ?? 100));
  if (options?.disabled) {
    root.setAttribute("data-disabled", "");
  }
  if (options?.positioning === "floating") {
    root.setAttribute("data-positioning", "floating");
  }
  root.innerHTML = `
    <button type="button" data-ormo-tooltip-trigger data-state="closed">
      Bold
    </button>
    <div
      role="tooltip"
      popover="manual"
      data-side="top"
      data-align="center"
      data-ormo-tooltip-content
      data-state="closed"
      style="--ormo-tooltip-side-offset: 6px"
    >
      ${options?.contentHtml ?? "Bold"}
    </div>
  `;
  document.body.append(root);

  const content = root.querySelector<HTMLElement>(
    "[data-ormo-tooltip-content]",
  )!;
  installPopoverPolyfill(content);

  root.remove();
  document.body.append(root);

  return {
    root,
    trigger: root.querySelector("[data-ormo-tooltip-trigger]")!,
    content,
  };
}

function pointerOver(element: Element): void {
  element.dispatchEvent(
    new Event("pointerover", { bubbles: true, composed: true }),
  );
}

function pointerOut(element: Element, relatedTarget: EventTarget | null): void {
  const event = new Event("pointerout", { bubbles: true, composed: true });
  Object.defineProperty(event, "relatedTarget", {
    configurable: true,
    value: relatedTarget,
  });
  element.dispatchEvent(event);
}

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (globalThis as { __ormoTooltipFloatingPositioner?: unknown })
    .__ormoTooltipFloatingPositioner;
  delete (globalThis as { __ormoTooltipSkipDelayUntil?: unknown })
    .__ormoTooltipSkipDelayUntil;
});

describe("tooltip", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("wires tooltip semantics without focusable content or expanded state", () => {
    const { root, trigger, content } = createTooltip();

    expect(content.getAttribute("role")).toBe("tooltip");
    expect(content.hasAttribute("tabindex")).toBe(false);
    expect(trigger.getAttribute("aria-describedby")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBeNull();
    expect(root.dataset.state).toBe("closed");
    expect(content.dataset.side).toBe("top");
  });

  it("opens on pointer interest after delay and sets aria-describedby", () => {
    const { root, trigger, content } = createTooltip({ delay: 700 });
    const changes: TooltipOpenChangeEvent["detail"][] = [];
    root.addEventListener("ormo:tooltip-open-change", (event) => {
      changes.push((event as TooltipOpenChangeEvent).detail);
    });

    pointerOver(trigger);
    expect(root.open).toBe(false);

    vi.advanceTimersByTime(699);
    expect(root.open).toBe(false);

    vi.advanceTimersByTime(1);
    expect(root.open).toBe(true);
    expect(trigger.getAttribute("aria-describedby")).toBe(content.id);
    expect(document.activeElement).not.toBe(content);
    expect(changes).toEqual([{ open: true, reason: "pointer" }]);
  });

  it("opens immediately on focus and closes on blur", () => {
    const { root, trigger, content } = createTooltip({ delay: 700 });

    trigger.focus();
    expect(root.open).toBe(true);
    expect(trigger.getAttribute("aria-describedby")).toBe(content.id);

    trigger.blur();
    expect(root.open).toBe(false);
    expect(trigger.getAttribute("aria-describedby")).toBeNull();
  });

  it("keeps the tooltip open while the pointer moves onto content", () => {
    const { root, trigger, content } = createTooltip({
      delay: 0,
      closeDelay: 100,
    });

    pointerOver(trigger);
    expect(root.open).toBe(true);

    pointerOut(trigger, content);
    pointerOver(content);
    vi.advanceTimersByTime(100);
    expect(root.open).toBe(true);

    pointerOut(content, null);
    vi.advanceTimersByTime(100);
    expect(root.open).toBe(false);
  });

  it("dismisses on Escape without moving focus", () => {
    const { root, trigger } = createTooltip({ delay: 0 });
    const changes: TooltipOpenChangeEvent["detail"][] = [];
    root.addEventListener("ormo:tooltip-open-change", (event) => {
      changes.push((event as TooltipOpenChangeEvent).detail);
    });

    trigger.focus();
    expect(root.open).toBe(true);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    expect(root.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(changes.at(-1)).toEqual({ open: false, reason: "escape" });
  });

  it("closes when the trigger is activated and does not reopen until interest resets", () => {
    const { root, trigger } = createTooltip({ delay: 0 });

    pointerOver(trigger);
    expect(root.open).toBe(true);

    trigger.click();
    expect(root.open).toBe(false);

    pointerOver(trigger);
    expect(root.open).toBe(false);

    pointerOut(trigger, null);
    if (document.activeElement === trigger) {
      trigger.blur();
    }
    pointerOver(trigger);
    expect(root.open).toBe(true);
  });

  it("skips open delay within the page-level grace period", () => {
    const first = createTooltip({ delay: 700 });
    const second = createTooltip({ delay: 700 });

    pointerOver(first.trigger);
    vi.advanceTimersByTime(700);
    expect(first.root.open).toBe(true);

    pointerOut(first.trigger, null);
    vi.advanceTimersByTime(100);
    expect(first.root.open).toBe(false);

    pointerOver(second.trigger);
    expect(second.root.open).toBe(true);
  });

  it("skips open delay when moving directly between tooltip triggers", () => {
    const first = createTooltip({ delay: 700, closeDelay: 100 });
    const second = createTooltip({ delay: 700 });

    pointerOver(first.trigger);
    vi.advanceTimersByTime(700);
    expect(first.root.open).toBe(true);

    pointerOut(first.trigger, second.trigger);
    pointerOver(second.trigger);

    expect(first.root.open).toBe(false);
    expect(second.root.open).toBe(true);
  });

  it("closes the previous tooltip when another opens", () => {
    const first = createTooltip({ delay: 0 });
    const second = createTooltip({ delay: 0 });

    pointerOver(first.trigger);
    expect(first.root.open).toBe(true);

    pointerOver(second.trigger);
    expect(first.root.open).toBe(false);
    expect(second.root.open).toBe(true);
  });

  it("does not open when disabled", () => {
    const { root, trigger } = createTooltip({ delay: 0, disabled: true });

    pointerOver(trigger);
    trigger.focus();
    expect(root.open).toBe(false);
  });

  it("supports detached triggers and restores authored trigger styles", () => {
    const root = document.createElement("ormo-tooltip") as OrmoTooltipElement;
    root.id = "toolbar-tip";
    root.setAttribute("data-delay", "0");
    root.setAttribute("data-close-delay", "0");
    root.innerHTML = `
      <div role="tooltip" popover="manual" data-ormo-tooltip-content data-side="top" data-align="center">
        Save
      </div>
    `;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.setAttribute("data-ormo-tooltip-trigger", "");
    trigger.setAttribute("data-ormo-tooltip-for", "toolbar-tip");
    trigger.style.setProperty(
      "anchor-name",
      "--authored-tooltip-anchor",
      "important",
    );
    trigger.textContent = "Save";

    document.body.append(trigger, root);
    const content = root.querySelector<HTMLElement>(
      "[data-ormo-tooltip-content]",
    )!;
    installPopoverPolyfill(content);
    root.remove();
    document.body.append(root);

    pointerOver(trigger);
    expect(root.open).toBe(true);
    expect(trigger.getAttribute("aria-describedby")).toBe(content.id);

    (
      root as OrmoTooltipElement & { disconnectedCallback(): void }
    ).disconnectedCallback();
    expect(trigger.style.getPropertyValue("anchor-name")).toBe(
      "--authored-tooltip-anchor",
    );
    expect(trigger.style.getPropertyPriority("anchor-name")).toBe("important");
  });

  it("warns when floating positioning is requested without the floating import", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    createTooltip({ positioning: "floating" });

    expect(
      warn.mock.calls.some((call) =>
        String(call[0]).includes('positioning="floating"'),
      ),
    ).toBe(true);
  });

  it("warns when content contains focusable elements", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    createTooltip({ contentHtml: '<a href="#docs">Learn more</a>' });

    expect(
      warn.mock.calls.some((call) =>
        String(call[0]).includes("focusable elements"),
      ),
    ).toBe(true);
  });

  it("applies the registered floating positioner", async () => {
    const { registerTooltipFloatingPositioner } =
      await import("../../src/runtime/tooltip");
    const positioner = vi.fn(() => () => {});
    registerTooltipFloatingPositioner(positioner);

    const { root, trigger, content } = createTooltip({
      delay: 0,
      positioning: "floating",
    });

    pointerOver(trigger);
    expect(positioner).toHaveBeenCalled();
    expect(content.getAttribute("data-ormo-tooltip-positioning")).toBe(
      "floating",
    );

    root.hide();
    expect(content.getAttribute("data-ormo-tooltip-positioning")).toBeNull();
  });

  it("exposes delay and disabled on the DOM API", () => {
    const { root } = createTooltip({ delay: 400, closeDelay: 50 });

    expect(root.delay).toBe(400);
    expect(root.closeDelay).toBe(50);
    expect(root.disabled).toBe(false);

    root.disabled = true;
    expect(root.hasAttribute("data-disabled")).toBe(true);
    root.show();
    expect(root.open).toBe(false);
  });
});
