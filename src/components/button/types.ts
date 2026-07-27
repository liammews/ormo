import type { HTMLAttributes } from "astro/types";

export type ButtonType = "button" | "submit" | "reset";

export interface ButtonAsButtonProps extends Omit<
  HTMLAttributes<"button">,
  "disabled" | "type"
> {
  as?: "button";
  /** Accepted for explicitness; native rendering is inferred from `as`. */
  nativeButton?: true;
  disabled?: boolean;
  type?: ButtonType;
  focusableWhenDisabled?: boolean;
  pending?: boolean;
}

export interface ButtonAsNonNativeProps extends Omit<
  HTMLAttributes<"div">,
  "disabled" | "type"
> {
  as: "div" | "span";
  /**
   * Accepted for explicitness; non-native rendering is inferred from `as`.
   * Prefer omitting it — `as="div" | "span"` is enough.
   */
  nativeButton?: false;
  disabled?: boolean;
  type?: never;
  focusableWhenDisabled?: boolean;
  pending?: boolean;
}

export type ButtonProps = ButtonAsButtonProps | ButtonAsNonNativeProps;
