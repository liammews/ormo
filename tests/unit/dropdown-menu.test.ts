import { afterEach, describe, expect, it } from "vitest";
import type { OrmoDropdownMenuElement } from "../../src/components/dropdown-menu/types";
import "../../src/runtime/dropdown-menu";

afterEach(() => {
  document.body.replaceChildren();
});

function installPopoverPolyfill(content: HTMLElement): void {
  let open = false;
  Object.defineProperty(content, "matches", {
    configurable: true,
    value(selectors: string) {
      return selectors === ":popover-open"
        ? open
        : HTMLElement.prototype.matches.call(this, selectors);
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

function setup(): OrmoDropdownMenuElement {
  const root = document.createElement("ormo-dropdown-menu");
  root.id = "actions";
  root.innerHTML = `
    <button data-ormo-dropdown-menu-trigger aria-expanded="false" style="anchor-name: --authored">Actions</button>
    <div id="actions-content" data-ormo-dropdown-menu-content role="menu">
      <div data-ormo-dropdown-menu-item role="menuitem" tabindex="-1">Duplicate</div>
      <div data-ormo-dropdown-menu-item role="menuitem" tabindex="-1">Rename</div>
      <div data-ormo-dropdown-menu-item data-disabled role="menuitem" tabindex="-1">Delete</div>
    </div>`;
  installPopoverPolyfill(
    root.querySelector("[data-ormo-dropdown-menu-content]")!,
  );
  document.body.append(root);
  return root;
}

function setupAdvanced(): OrmoDropdownMenuElement {
  const root = document.createElement("ormo-dropdown-menu");
  root.id = "advanced";
  root.innerHTML = `
    <button data-ormo-dropdown-menu-trigger>Actions</button>
    <div data-ormo-dropdown-menu-content role="menu">
      <div data-ormo-dropdown-menu-item data-ormo-dropdown-menu-checkbox-item role="menuitemcheckbox" aria-checked="false" tabindex="-1">Grid</div>
      <div data-ormo-dropdown-menu-radio-group data-value="light" role="group">
        <div data-ormo-dropdown-menu-item data-ormo-dropdown-menu-radio-item data-value="light" role="menuitemradio" tabindex="-1">Light</div>
        <div data-ormo-dropdown-menu-item data-ormo-dropdown-menu-radio-item data-value="dark" role="menuitemradio" tabindex="-1">Dark</div>
      </div>
      <ormo-dropdown-menu id="more" data-submenu>
        <div data-ormo-dropdown-menu-trigger data-ormo-dropdown-menu-item data-ormo-dropdown-menu-sub-trigger role="menuitem" tabindex="-1">More</div>
        <div data-ormo-dropdown-menu-content data-ormo-dropdown-menu-sub-content role="menu">
          <div data-ormo-dropdown-menu-item role="menuitem" tabindex="-1">Export</div>
        </div>
      </ormo-dropdown-menu>
    </div>`;
  for (const content of root.querySelectorAll<HTMLElement>(
    "[data-ormo-dropdown-menu-content]",
  ))
    installPopoverPolyfill(content);
  document.body.append(root);
  return root;
}

describe("Dropdown Menu", () => {
  it("opens from the trigger and focuses from ArrowDown", async () => {
    const root = setup();
    const trigger = root.querySelector("button")!;
    trigger.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(root.open).toBe(true);
    expect(document.activeElement?.textContent).toBe("Duplicate");
  });

  it("moves focus, loops, and closes after selection", async () => {
    const root = setup();
    root.show();
    const items = root.querySelectorAll<HTMLElement>("[role=menuitem]");
    items[1]!.focus();
    items[1]!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(document.activeElement).toBe(items[2]);
    items[2]!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(document.activeElement).toBe(items[0]);
    items[0]!.click();
    expect(root.open).toBe(false);
  });

  it("keeps disabled items focusable but prevents activation", async () => {
    const root = setup();
    root.show();
    const disabled = root.querySelector<HTMLElement>("[data-disabled]")!;
    disabled.focus();
    disabled.click();
    expect(root.open).toBe(true);
  });

  it("allows selection cancellation", async () => {
    const root = setup();
    root.show();
    root.addEventListener("ormo:dropdown-menu-before-select", (event) =>
      event.preventDefault(),
    );
    root.querySelector<HTMLElement>("[role=menuitem]")!.click();
    expect(root.open).toBe(true);
  });

  it("updates checkbox state and emits its change detail", () => {
    const root = setupAdvanced();
    root.show();
    const item = root.querySelector<HTMLElement>(
      "[data-ormo-dropdown-menu-checkbox-item]",
    )!;
    let checked: boolean | undefined;
    item.addEventListener("ormo:dropdown-menu-checked-change", (event) => {
      checked = event.detail.checked;
    });
    item.click();
    expect(item.getAttribute("aria-checked")).toBe("true");
    expect(item.getAttribute("data-state")).toBe("checked");
    expect(checked).toBe(true);
  });

  it("maintains one checked radio item and emits the selected value", () => {
    const root = setupAdvanced();
    root.show();
    const items = root.querySelectorAll<HTMLElement>(
      "[data-ormo-dropdown-menu-radio-item]",
    );
    let value: string | undefined;
    items[1]!.addEventListener("ormo:dropdown-menu-value-change", (event) => {
      value = event.detail.value;
    });
    items[1]!.click();
    expect(items[0]!.getAttribute("aria-checked")).toBe("false");
    expect(items[1]!.getAttribute("aria-checked")).toBe("true");
    expect(value).toBe("dark");
  });

  it("opens a submenu with the directional key and restores its trigger", () => {
    const root = setupAdvanced();
    root.show();
    const submenu = root.querySelector<OrmoDropdownMenuElement>("#more")!;
    const trigger = submenu.querySelector<HTMLElement>(
      "[data-ormo-dropdown-menu-sub-trigger]",
    )!;
    trigger.focus();
    trigger.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(submenu.open).toBe(true);
    expect(document.activeElement?.textContent).toBe("Export");
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    );
    expect(submenu.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it("closes the complete menu chain after submenu selection", () => {
    const root = setupAdvanced();
    root.show();
    const submenu = root.querySelector<OrmoDropdownMenuElement>("#more")!;
    submenu.show();
    submenu
      .querySelector<HTMLElement>(
        "[data-ormo-dropdown-menu-content] [role=menuitem]",
      )!
      .click();
    expect(submenu.open).toBe(false);
    expect(root.open).toBe(false);
    expect(document.activeElement).toBe(root.querySelector("button"));
  });

  it("keeps a submenu open during pointer movement into its content", async () => {
    const root = setupAdvanced();
    root.show();
    const submenu = root.querySelector<OrmoDropdownMenuElement>("#more")!;
    submenu.show();
    root
      .querySelector<HTMLElement>("[data-ormo-dropdown-menu-checkbox-item]")!
      .dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerType: "mouse",
        }),
      );
    submenu
      .querySelector<HTMLElement>(
        "[data-ormo-dropdown-menu-content] [role=menuitem]",
      )!
      .dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerType: "mouse",
        }),
      );
    await new Promise((resolve) => setTimeout(resolve, 140));
    expect(submenu.open).toBe(true);
  });

  it("uses ArrowLeft to open an RTL submenu", () => {
    const root = setupAdvanced();
    root.dir = "rtl";
    root.show();
    const submenu = root.querySelector<OrmoDropdownMenuElement>("#more")!;
    const trigger = submenu.querySelector<HTMLElement>(
      "[data-ormo-dropdown-menu-sub-trigger]",
    )!;
    trigger.focus();
    trigger.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    );
    expect(submenu.open).toBe(true);
  });

  it("restores authored attributes and styles after disconnect", () => {
    const root = setup();
    const trigger = root.querySelector<HTMLElement>("button")!;
    const content = root.querySelector<HTMLElement>(
      "[data-ormo-dropdown-menu-content]",
    )!;
    root.remove();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-controls")).toBeNull();
    expect(trigger.style.getPropertyValue("anchor-name")).toBe("--authored");
    expect(content.getAttribute("data-state")).toBeNull();
  });

  it("releases replaced content before managing its replacement", async () => {
    const root = setup();
    const original = root.querySelector<HTMLElement>(
      "[data-ormo-dropdown-menu-content]",
    )!;
    const replacement = document.createElement("div");
    replacement.dataset.ormoDropdownMenuContent = "";
    replacement.innerHTML =
      '<div data-ormo-dropdown-menu-item role="menuitem" tabindex="-1">New</div>';
    installPopoverPolyfill(replacement);
    original.replaceWith(replacement);
    await Promise.resolve();
    expect(original.style.getPropertyValue("--ormo-dropdown-menu-anchor")).toBe(
      "",
    );
    expect(replacement.id).toBe("actions-content");
    expect(root.querySelector("button")?.getAttribute("aria-controls")).toBe(
      "actions-content",
    );
  });
});
