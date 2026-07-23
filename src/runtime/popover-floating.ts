import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from "@floating-ui/dom";

import {
  registerPopoverFloatingPositioner,
  type PopoverPositionerContext,
} from "./popover";

function mapPlacement(
  side: PopoverPositionerContext["side"],
  align: PopoverPositionerContext["align"],
):
  | "top"
  | "top-start"
  | "top-end"
  | "right"
  | "right-start"
  | "right-end"
  | "bottom"
  | "bottom-start"
  | "bottom-end"
  | "left"
  | "left-start"
  | "left-end" {
  if (align === "center") {
    return side;
  }

  if (side === "top" || side === "bottom") {
    return align === "start" ? `${side}-start` : `${side}-end`;
  }

  return align === "start" ? `${side}-start` : `${side}-end`;
}

registerPopoverFloatingPositioner(
  ({ trigger, content, side, align, sideOffset }) => {
    if (!trigger) {
      return;
    }

    const placement = mapPlacement(side, align);

    return autoUpdate(trigger, content, () => {
      void computePosition(trigger, content, {
        placement,
        strategy: "fixed",
        middleware: [offset(sideOffset), flip(), shift({ padding: 8 })],
      }).then(({ x, y, placement: resolved }) => {
        Object.assign(content.style, {
          left: `${x}px`,
          top: `${y}px`,
          right: "auto",
          bottom: "auto",
          margin: "0",
          position: "fixed",
        });

        const [resolvedSide, resolvedAlign] = resolved.split("-") as [
          PopoverPositionerContext["side"],
          "start" | "end" | undefined,
        ];
        content.dataset.side = resolvedSide;
        content.dataset.align = resolvedAlign ?? "center";
      });
    });
  },
);
