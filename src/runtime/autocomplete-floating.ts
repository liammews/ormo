import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from "@floating-ui/dom";
import { floatingPlacement } from "../internal/floating-placement";
import { registerAutocompleteFloatingPositioner } from "./autocomplete";

registerAutocompleteFloatingPositioner(
  ({ trigger, content, side, align, sideOffset }) => {
    let active = true;
    const stop = autoUpdate(trigger, content, () => {
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
          position: "fixed",
        });
        const [resolvedSide, resolvedAlign] = placement.split("-");
        content.dataset.resolvedSide = resolvedSide;
        content.dataset.resolvedAlign = resolvedAlign ?? "center";
      });
    });
    return () => {
      active = false;
      stop();
      for (const property of ["left", "top", "right", "bottom", "position"])
        content.style.removeProperty(property);
      delete content.dataset.resolvedSide;
      delete content.dataset.resolvedAlign;
    };
  },
);
