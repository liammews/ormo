import type { HTMLAttributes } from "astro/types";

export interface ButtonAsButtonProps extends HTMLAttributes<"button"> {
  as?: "button";
  /** Accepted for explicitness; native rendering is inferred from `as`. */
  nativeButton?: true;
  focusableWhenDisabled?: boolean;
  pending?: boolean;
}

export interface ButtonAsNonNativeProps extends HTMLAttributes<"div"> {
  as: "div" | "span";
  /**
   * Accepted for explicitness; non-native rendering is inferred from `as`.
   * Prefer omitting it — `as="div" | "span"` is enough.
   */
  nativeButton?: false;
  disabled?: boolean;
  focusableWhenDisabled?: boolean;
  pending?: boolean;
}

export type ButtonProps = ButtonAsButtonProps | ButtonAsNonNativeProps;
