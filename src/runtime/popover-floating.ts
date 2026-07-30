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
import { registerPopoverFloatingPositioner } from "./popover";

registerPopoverFloatingPositioner(
  ({ trigger, content, side, align, sideOffset }) => {
    if (!trigger) {
      return;
    }

    const placement = floatingPlacement(side, align);
    let active = true;

    const stop = autoUpdate(trigger, content, () => {
      if (!active) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      content.style.setProperty(
        "--ormo-popover-trigger-width",
        `${rect.width}px`,
      );
      content.style.setProperty(
        "--ormo-popover-trigger-height",
        `${rect.height}px`,
      );

      void computePosition(trigger, content, {
        placement,
        strategy: "fixed",
        middleware: [offset(sideOffset), flip(), shift({ padding: 8 })],
      }).then(({ x, y, placement: resolved }) => {
        if (!active) {
          return;
        }

        Object.assign(content.style, {
          left: `${x}px`,
          top: `${y}px`,
          right: "auto",
          bottom: "auto",
          margin: "0",
          position: "fixed",
        });

        const [resolvedSide, resolvedAlign] = resolved.split("-") as [
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
    };
  },
);
