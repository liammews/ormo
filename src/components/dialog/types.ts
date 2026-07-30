import type { HTMLAttributes } from "astro/types";
import type { ButtonAsButtonProps } from "../button/types";

export type DialogCloseReason = "close" | "escape" | "outside" | "programmatic";
export type DialogBeforeCloseReason = Exclude<
  DialogCloseReason,
  "programmatic"
>;

export interface DialogRootProps extends HTMLAttributes<"div"> {
  /** Prevents pointer presses outside Content from closing the dialog. */
  disablePointerDismissal?: boolean;
}

export interface DialogTriggerProps extends HTMLAttributes<"button"> {
  /** ID of a Dialog Root when the Trigger is rendered outside it. */
  for?: string;
}

export type DialogContentProps = Omit<
  HTMLAttributes<"dialog">,
  "open" | "role"
> & {
  /** CSS selector for an explicit focus-restoration destination. */
  finalFocus?: string;
};

export interface DialogTitleProps extends HTMLAttributes<"h2"> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export interface DialogDescriptionProps extends HTMLAttributes<"p"> {
  as?: "p" | "div";
}

export type DialogCloseProps = Omit<ButtonAsButtonProps, "as" | "nativeButton">;

export interface DialogOpenChangeDetail {
  open: boolean;
  reason: DialogCloseReason | "trigger";
  returnValue: string;
}

export interface DialogBeforeCloseDetail {
  reason: DialogBeforeCloseReason;
  returnValue: string;
  originalEvent: Event;
}

export type DialogBeforeCloseEvent = CustomEvent<DialogBeforeCloseDetail>;
export type DialogOpenChangeEvent = CustomEvent<DialogOpenChangeDetail>;

export interface OrmoDialogElement extends HTMLElement {
  finalFocus: HTMLElement | null;
  readonly open: boolean;
  showModal(): void;
  close(returnValue?: string): void;
}

declare global {
  interface HTMLElementTagNameMap {
    "ormo-dialog": OrmoDialogElement;
  }

  interface GlobalEventHandlersEventMap {
    "ormo:dialog-before-close": DialogBeforeCloseEvent;
    "ormo:dialog-open-change": DialogOpenChangeEvent;
  }
}
