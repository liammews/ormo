import type { HTMLAttributes } from "astro/types";
import type { InputProps } from "../input/types";

export interface PasswordFieldRootProps extends HTMLAttributes<"div"> {
  /** Shows the password when the server renders the initial field. */
  defaultVisible?: boolean;
}

export type PasswordFieldInputProps = Omit<InputProps, "type">;

export interface PasswordFieldToggleProps extends Omit<
  HTMLAttributes<"button">,
  "type"
> {
  /** Accessible name used while the password is visible. */
  hideLabel: string;
  /** Accessible name used while the password is hidden. */
  showLabel: string;
}

export type PasswordVisibilityChangeReason =
  "pagehide" | "programmatic" | "reset" | "submit" | "toggle";

export interface PasswordVisibilityChangeDetail {
  previousVisible: boolean;
  reason: PasswordVisibilityChangeReason;
  visible: boolean;
}

export interface OrmoPasswordFieldElement extends HTMLElement {
  visible: boolean;
}

declare global {
  interface HTMLElementTagNameMap {
    "ormo-password-field": OrmoPasswordFieldElement;
  }

  interface GlobalEventHandlersEventMap {
    "ormo:password-visibility-change": CustomEvent<PasswordVisibilityChangeDetail>;
  }
}
