import type { HTMLAttributes } from "astro/types";

export type SeparatorOrientation = "horizontal" | "vertical";

export interface SeparatorProps extends HTMLAttributes<"div"> {
  /** Removes the separator from the accessibility tree. */
  decorative?: boolean;
  /** The direction in which the separator divides content. */
  orientation?: SeparatorOrientation;
}
