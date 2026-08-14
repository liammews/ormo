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
import { registerPreviewCardFloatingPositioner } from "./preview-card";

registerPreviewCardFloatingPositioner(
  ({ trigger, content, side, align, sideOffset }) => {
    let active = true;
    const authoredWidth = content.style.getPropertyValue(
      "--ormo-preview-card-trigger-width",
    );
    const authoredHeight = content.style.getPropertyValue(
      "--ormo-preview-card-trigger-height",
    );
    const stop = autoUpdate(trigger, content, () => {
      const rect = trigger.getBoundingClientRect();
      content.style.setProperty(
        "--ormo-preview-card-trigger-width",
        `${rect.width}px`,
      );
      content.style.setProperty(
        "--ormo-preview-card-trigger-height",
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
      if (authoredWidth) {
        content.style.setProperty(
          "--ormo-preview-card-trigger-width",
          authoredWidth,
        );
      } else {
        content.style.removeProperty("--ormo-preview-card-trigger-width");
      }
      if (authoredHeight) {
        content.style.setProperty(
          "--ormo-preview-card-trigger-height",
          authoredHeight,
        );
      } else {
        content.style.removeProperty("--ormo-preview-card-trigger-height");
      }
    };
  },
);
