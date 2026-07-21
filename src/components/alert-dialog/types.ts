import type { HTMLAttributes } from "astro/types";
import type { ButtonAsButtonProps } from "../button/types";

export type AlertDialogCloseReason =
  "action" | "cancel" | "escape" | "programmatic";

export type AlertDialogRootProps = HTMLAttributes<"div">;
export interface AlertDialogTriggerProps extends HTMLAttributes<"button"> {
  /** ID of an Alert Dialog Root when the Trigger is rendered outside it. */
  for?: string;
}
export type AlertDialogContentProps = Omit<
  HTMLAttributes<"dialog">,
  "open" | "role"
> & {
  /** CSS selector for an explicit focus-restoration destination. */
  finalFocus?: string;
};

export interface AlertDialogTitleProps extends HTMLAttributes<"h2"> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export interface AlertDialogDescriptionProps extends HTMLAttributes<"p"> {
  as?: "p" | "div";
}

export type AlertDialogCancelProps = Omit<
  ButtonAsButtonProps,
  "as" | "nativeButton"
>;
export type AlertDialogActionProps = Omit<
  ButtonAsButtonProps,
  "as" | "nativeButton"
>;

export interface AlertDialogOpenChangeDetail {
  open: boolean;
  reason: AlertDialogCloseReason | "trigger";
  returnValue: string;
}

export type AlertDialogOpenChangeEvent =
  CustomEvent<AlertDialogOpenChangeDetail>;

export interface OrmoAlertDialogElement extends HTMLElement {
  finalFocus: HTMLElement | null;
  readonly open: boolean;
  showModal(): void;
  close(returnValue?: string): void;
}

declare global {
  interface HTMLElementTagNameMap {
    "ormo-alert-dialog": OrmoAlertDialogElement;
  }

  interface GlobalEventHandlersEventMap {
    "ormo:alert-dialog-open-change": AlertDialogOpenChangeEvent;
  }
}
