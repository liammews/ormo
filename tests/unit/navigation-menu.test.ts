import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrmoNavigationMenuElement } from "../../src/components/navigation-menu/types";
import { registerNavigationMenuFloatingPositioner } from "../../src/runtime/navigation-menu";

function createMenu(defaultValue?: string): OrmoNavigationMenuElement {
  const root = document.createElement("ormo-navigation-menu");
  if (defaultValue) root.dataset.value = defaultValue;
  root.innerHTML = `<nav><ul data-ormo-navigation-menu-list>
    <li data-ormo-navigation-menu-item data-value="products">
      <button data-ormo-navigation-menu-trigger>Products</button>
      <div data-ormo-navigation-menu-content><a href="/one">One</a></div>
    </li>
    <li data-ormo-navigation-menu-item data-value="company">
      <button data-ormo-navigation-menu-trigger>Company</button>
      <div data-ormo-navigation-menu-content><a href="/two">Two</a></div>
    </li>
    <li data-ormo-navigation-menu-item data-value="about">
      <a href="/about" data-ormo-navigation-menu-link>About</a>
    </li>
  </ul></nav>`;
  document.body.append(root);
  return root;
}

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe("navigation menu", () => {
  it("does not require secure-context crypto APIs", () => {
    const randomUUID = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", {
      configurable: true,
      value: undefined,
    });

    try {
      const root = createMenu();
      const trigger = root.querySelector<HTMLButtonElement>(
        "[data-ormo-navigation-menu-trigger]",
      );
      trigger?.click();
      expect(root.value).toBe("products");
      expect(trigger?.getAttribute("aria-controls")).toMatch(
        /^ormo-navigation-menu-\d+$/,
      );
    } finally {
      Object.defineProperty(crypto, "randomUUID", {
        configurable: true,
        value: randomUUID,
      });
    }
  });

  it("synchronises its initial disclosure state", () => {
    const root = createMenu("products");
    const triggers = root.querySelectorAll<HTMLButtonElement>(
      "[data-ormo-navigation-menu-trigger]",
    );
    const contents = root.querySelectorAll<HTMLElement>(
      "[data-ormo-navigation-menu-content]",
    );
    expect(root.value).toBe("products");
    expect(triggers[0]?.getAttribute("aria-expanded")).toBe("true");
    expect(triggers[0]?.getAttribute("aria-controls")).toBe(contents[0]?.id);
    expect(contents[0]?.hidden).toBe(false);
    expect(contents[1]?.hidden).toBe(true);
  });

  it("starts positioning an initially open item after late registration", () => {
    const root = createMenu("products");
    root.dataset.positioning = "floating";
    const content = root.querySelector<HTMLElement>(
      "[data-ormo-navigation-menu-content]",
    )!;

    registerNavigationMenuFloatingPositioner(
      ({ content: positioned, align }) => {
        positioned.dataset.testPositioned = "";
        positioned.dataset.testAlign = align;
        positioned.style.left = "100px";
        positioned.style.position = "fixed";
        return () => {
          delete positioned.dataset.testPositioned;
          delete positioned.dataset.testAlign;
        };
      },
    );

    expect(content.hasAttribute("data-test-positioned")).toBe(true);
    expect(content.getAttribute("data-ormo-navigation-menu-positioning")).toBe(
      "floating",
    );
  });

  it("reacts to positioning changes and restores authored styles", async () => {
    const root = createMenu("products");
    const content = root.querySelector<HTMLElement>(
      "[data-ormo-navigation-menu-content]",
    )!;
    content.style.left = "12px";
    content.style.position = "absolute";
    root.dataset.positioning = "floating";
    await Promise.resolve();

    expect(content.hasAttribute("data-test-positioned")).toBe(true);
    expect(content.style.left).toBe("100px");
    content.dataset.align = "center";
    await Promise.resolve();
    expect(content.dataset.testAlign).toBe("center");
    root.removeAttribute("data-positioning");
    await Promise.resolve();

    expect(content.hasAttribute("data-test-positioned")).toBe(false);
    expect(content.style.left).toBe("12px");
    expect(content.style.position).toBe("absolute");
  });

  it("opens one item, closes it, and emits cancellable changes", () => {
    const root = createMenu();
    const triggers = root.querySelectorAll<HTMLButtonElement>(
      "[data-ormo-navigation-menu-trigger]",
    );
    const reasons: string[] = [];
    root.addEventListener("ormo:open-change", (event) =>
      reasons.push(event.detail.reason),
    );
    triggers[0]?.click();
    expect(root.value).toBe("products");
    triggers[1]?.click();
    expect(root.value).toBe("company");
    triggers[1]?.click();
    expect(root.value).toBeNull();
    expect(reasons).toEqual(["trigger", "trigger", "trigger"]);
  });

  it("honours prevented and controlled changes", () => {
    const root = createMenu();
    root.addEventListener(
      "ormo:open-change",
      (event) => event.preventDefault(),
      { once: true },
    );
    expect(root.open("products")).toBe(false);
    expect(root.value).toBeNull();
    root.setAttribute("data-controlled", "");
    root
      .querySelector<HTMLButtonElement>("[data-ormo-navigation-menu-trigger]")
      ?.click();
    expect(root.value).toBeNull();
    root.value = "products";
    expect(root.value).toBe("products");
  });

  it("supports arrow navigation and Escape focus restoration", () => {
    const root = createMenu();
    const triggers = root.querySelectorAll<HTMLButtonElement>(
      "[data-ormo-navigation-menu-trigger]",
    );
    triggers[0]?.focus();
    triggers[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(document.activeElement).toBe(triggers[1]);
    triggers[1]?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(root.value).toBe("company");
    expect(document.activeElement?.textContent).toBe("Two");
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(root.value).toBeNull();
    expect(document.activeElement).toBe(triggers[1]);
  });

  it("opens with a pointer delay and cleans up on reconnection", () => {
    vi.useFakeTimers();
    const root = createMenu();
    const trigger = root.querySelector<HTMLButtonElement>(
      "[data-ormo-navigation-menu-trigger]",
    )!;
    trigger.dispatchEvent(
      new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }),
    );
    vi.advanceTimersByTime(200);
    expect(root.value).toBe("products");
    root.remove();
    document.body.append(root);
    trigger.click();
    expect(root.value).toBeNull();
  });
});
