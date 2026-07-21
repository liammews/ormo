import type { HTMLAttributes } from "astro/types";

export interface ButtonAsButtonProps extends HTMLAttributes<"button"> {
  as?: "button";
  nativeButton?: true;
  focusableWhenDisabled?: boolean;
  pending?: boolean;
}

export interface ButtonAsNonNativeProps extends HTMLAttributes<"div"> {
  as: "div" | "span";
  nativeButton: false;
  disabled?: boolean;
  focusableWhenDisabled?: boolean;
  pending?: boolean;
}

export type ButtonProps = ButtonAsButtonProps | ButtonAsNonNativeProps;
