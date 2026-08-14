import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from "@floating-ui/dom";
import {
  floatingPlacement,
  type FloatingSide,
} from "../internal/floating-placement";
import { registerDropdownMenuFloatingPositioner } from "./dropdown-menu";

registerDropdownMenuFloatingPositioner(
  ({ trigger, content, side, align, sideOffset }) => {
    let active = true;
    const authoredStyles = {
      bottom: content.style.bottom,
      left: content.style.left,
      margin: content.style.margin,
      position: content.style.position,
      right: content.style.right,
      top: content.style.top,
    };
    const authoredResolvedSide = content.getAttribute("data-resolved-side");
    const authoredResolvedAlign = content.getAttribute("data-resolved-align");
    const authoredWidth = content.style.getPropertyValue(
      "--ormo-dropdown-menu-trigger-width",
    );
    const authoredHeight = content.style.getPropertyValue(
      "--ormo-dropdown-menu-trigger-height",
    );
    const stop = autoUpdate(trigger, content, () => {
      const rect = trigger.getBoundingClientRect();
      content.style.setProperty(
        "--ormo-dropdown-menu-trigger-width",
        `${rect.width}px`,
      );
      content.style.setProperty(
        "--ormo-dropdown-menu-trigger-height",
        `${rect.height}px`,
      );
      void computePosition(trigger, content, {
        placement: floatingPlacement(side, align),
        strategy: "fixed",
        middleware: [offset(sideOffset), flip(), shift({ padding: 8 })],
      }).then(({ x, y, placement }) => {
        if (!active) return;
        Object.assign(content.style, {
          left: `${x}px`,
          top: `${y}px`,
          right: "auto",
          bottom: "auto",
          margin: "0",
          position: "fixed",
        });
        const [resolvedSide, resolvedAlign] = placement.split("-") as [
          FloatingSide,
          "start" | "end" | undefined,
        ];
        content.dataset.resolvedSide = resolvedSide;
        content.dataset.resolvedAlign = resolvedAlign ?? "center";
      });
    });
    return () => {
      active = false;
      stop();
      for (const [name, value] of Object.entries(authoredStyles)) {
        if (value) content.style.setProperty(name, value);
        else content.style.removeProperty(name);
      }
      if (authoredResolvedSide === null)
        content.removeAttribute("data-resolved-side");
      else content.setAttribute("data-resolved-side", authoredResolvedSide);
      if (authoredResolvedAlign === null)
        content.removeAttribute("data-resolved-align");
      else content.setAttribute("data-resolved-align", authoredResolvedAlign);
      if (authoredWidth)
        content.style.setProperty(
          "--ormo-dropdown-menu-trigger-width",
          authoredWidth,
        );
      else content.style.removeProperty("--ormo-dropdown-menu-trigger-width");
      if (authoredHeight)
        content.style.setProperty(
          "--ormo-dropdown-menu-trigger-height",
          authoredHeight,
        );
      else content.style.removeProperty("--ormo-dropdown-menu-trigger-height");
    };
  },
);
