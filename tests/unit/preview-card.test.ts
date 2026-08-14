import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrmoPreviewCardElement } from "../../src/components/preview-card/types";
import {
  type PreviewCardPositionerContext,
  registerPreviewCardFloatingPositioner,
} from "../../src/runtime/preview-card";

function installPopover(content: HTMLElement): void {
  let open = false;
  Object.defineProperty(content, "matches", {
    configurable: true,
    value(selector: string) {
      return selector === ":popover-open"
        ? open
        : HTMLElement.prototype.matches.call(this, selector);
    },
  });
  Object.assign(content, {
    showPopover() {
      open = true;
      content.setAttribute("data-open", "");
      const event = new Event("toggle", { bubbles: true });
      Object.assign(event, { newState: "open" });
      content.dispatchEvent(event);
    },
    hidePopover() {
      open = false;
      content.removeAttribute("data-open");
      const event = new Event("toggle", { bubbles: true });
      Object.assign(event, { newState: "closed" });
      content.dispatchEvent(event);
    },
  });
}

function createPreview(options?: {
  delay?: number;
  closeDelay?: number;
  floating?: boolean;
}) {
  const root = document.createElement("ormo-preview-card");
  root.id = "preview";
  root.dataset.delay = String(options?.delay ?? 600);
  root.dataset.closeDelay = String(options?.closeDelay ?? 300);
  if (options?.floating) root.dataset.positioning = "floating";
  root.innerHTML = `
    <a href="/destination" data-ormo-preview-card-trigger>Destination</a>
    <div aria-hidden="true" popover="manual" data-side="top" data-align="center" data-ormo-preview-card-content>Preview</div>`;
  const content = root.querySelector<HTMLElement>(
    "[data-ormo-preview-card-content]",
  )!;
  installPopover(content);
  document.body.append(root);
  return {
    root: root as OrmoPreviewCardElement,
    trigger: root.querySelector<HTMLAnchorElement>("a")!,
    content,
  };
}

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe("Preview Card", () => {
  it("opens after pointer intent and closes after leaving", () => {
    vi.useFakeTimers();
    const { root, trigger } = createPreview();
    const enter = new Event("pointerover", { bubbles: true });
    Object.assign(enter, { pointerType: "mouse" });
    trigger.dispatchEvent(enter);
    vi.advanceTimersByTime(599);
    expect(root.open).toBe(false);
    vi.advanceTimersByTime(1);
    expect(root.open).toBe(true);
    const leave = new Event("pointerout", { bubbles: true });
    Object.assign(leave, {
      pointerType: "mouse",
      relatedTarget: document.body,
    });
    trigger.dispatchEvent(leave);
    vi.advanceTimersByTime(300);
    expect(root.open).toBe(false);
  });

  it("opens visually on link focus without moving focus", () => {
    const { root, trigger, content } = createPreview();
    trigger.focus();
    expect(root.open).toBe(true);
    expect(document.activeElement).toBe(trigger);
    expect(content.getAttribute("aria-hidden")).toBe("true");
  });

  it("stays open while the pointer crosses into content", () => {
    vi.useFakeTimers();
    const { root, trigger, content } = createPreview({ delay: 0 });
    const enter = new Event("pointerover", { bubbles: true });
    Object.assign(enter, { pointerType: "mouse" });
    trigger.dispatchEvent(enter);
    const leave = new Event("pointerout", { bubbles: true });
    Object.assign(leave, { pointerType: "mouse", relatedTarget: content });
    trigger.dispatchEvent(leave);
    vi.advanceTimersByTime(1000);
    expect(root.open).toBe(true);
  });

  it("dismisses with Escape", () => {
    const { root } = createPreview();
    root.show();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(root.open).toBe(false);
  });

  it("positions an open card after optional Floating UI registration", () => {
    const { root, content } = createPreview({ floating: true });
    root.show();
    registerPreviewCardFloatingPositioner(({ content: target }) => {
      target.dataset.positioned = "";
      target.style.left = "20px";
      return () => delete target.dataset.positioned;
    });
    expect(content.hasAttribute("data-positioned")).toBe(true);
    root.hide();
    expect(content.hasAttribute("data-positioned")).toBe(false);
    expect(content.style.left).toBe("");
  });

  it("restores authored part state when disconnected and reconnects cleanly", () => {
    const { root, trigger, content } = createPreview();
    root.remove();
    trigger.style.setProperty("anchor-name", "--authored", "important");
    content.setAttribute("role", "note");
    content.setAttribute("tabindex", "2");
    content.style.setProperty("--ormo-preview-card-anchor", "--authored");
    document.body.append(root);

    root.remove();
    expect(trigger.style.getPropertyValue("anchor-name")).toBe("--authored");
    expect(trigger.style.getPropertyPriority("anchor-name")).toBe("important");
    expect(content.getAttribute("role")).toBe("note");
    expect(content.getAttribute("tabindex")).toBe("2");
    expect(content.style.getPropertyValue("--ormo-preview-card-anchor")).toBe(
      "--authored",
    );

    document.body.append(root);
    root.show();
    expect(root.open).toBe(true);
  });

  it("releases an old positioned content part when it is replaced", async () => {
    const cleanup = vi.fn();
    registerPreviewCardFloatingPositioner(() => cleanup);
    const { root, content } = createPreview({ floating: true });
    root.show();

    const replacement = document.createElement("div");
    replacement.setAttribute("data-ormo-preview-card-content", "");
    replacement.dataset.side = "bottom";
    replacement.dataset.align = "start";
    installPopover(replacement);
    content.replaceWith(replacement);
    await vi.waitFor(() => expect(cleanup).toHaveBeenCalled());

    root.show();
    expect(root.open).toBe(true);
    expect(replacement.getAttribute("aria-hidden")).toBe("true");
  });

  it("restarts Floating UI when placement and side offset change", async () => {
    const positioner = vi.fn((context: PreviewCardPositionerContext) => {
      void context;
      return undefined;
    });
    registerPreviewCardFloatingPositioner(positioner);
    const { root, content } = createPreview({ floating: true });
    root.show();
    const initialCalls = positioner.mock.calls.length;

    content.dataset.align = "end";
    content.style.setProperty("--ormo-preview-card-side-offset", "12px");
    await vi.waitFor(() =>
      expect(positioner.mock.calls.length).toBeGreaterThan(initialCalls),
    );
    expect(positioner.mock.calls.at(-1)?.[0]).toMatchObject({
      align: "end",
      sideOffset: 12,
    });
  });

  it("does not open while disabled", () => {
    const { root, trigger } = createPreview({ delay: 0 });
    root.disabled = true;
    trigger.focus();
    expect(root.open).toBe(false);
    root.show();
    expect(root.open).toBe(false);
  });

  it("generates and then releases an id for a manually authored root", () => {
    const { root } = createPreview();
    root.removeAttribute("id");
    root.remove();
    document.body.append(root);
    expect(root.id).toMatch(/^ormo-preview-card-runtime-/);
    root.remove();
    expect(root.hasAttribute("id")).toBe(false);
  });

  it("emits reasoned open changes", () => {
    const { root, trigger } = createPreview();
    const changes: Array<{ open: boolean; reason: string }> = [];
    root.addEventListener("ormo:preview-card-open-change", (event) => {
      changes.push(event.detail);
    });
    trigger.focus();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(changes).toEqual([
      { open: true, reason: "focus" },
      { open: false, reason: "escape" },
    ]);
  });
});
