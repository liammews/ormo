import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from "@floating-ui/dom";

import { floatingPlacement } from "../internal/floating-placement";
import { registerNavigationMenuFloatingPositioner } from "./navigation-menu";

registerNavigationMenuFloatingPositioner(
  ({ trigger, content, side, align, sideOffset }) => {
    let active = true;
    const stop = autoUpdate(trigger, content, () => {
      void computePosition(trigger, content, {
        placement: floatingPlacement(side, align),
        strategy: "fixed",
        middleware: [offset(sideOffset), flip(), shift({ padding: 8 })],
      }).then(({ x, y, placement: resolved }) => {
        if (!active) return;
        Object.assign(content.style, {
          left: `${x}px`,
          top: `${y}px`,
          right: "auto",
          bottom: "auto",
          position: "fixed",
        });
        const [resolvedSide, resolvedAlign] = resolved.split("-");
        content.dataset.resolvedSide = resolvedSide;
        content.dataset.resolvedAlign = resolvedAlign ?? "center";
      });
    });

    return () => {
      active = false;
      stop();
      content.style.removeProperty("left");
      content.style.removeProperty("top");
      content.style.removeProperty("right");
      content.style.removeProperty("bottom");
      content.style.removeProperty("position");
      delete content.dataset.resolvedSide;
      delete content.dataset.resolvedAlign;
    };
  },
);
