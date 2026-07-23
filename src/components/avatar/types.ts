import type { HTMLAttributes } from "astro/types";

export type ImageLoadingStatus = "loading" | "loaded" | "error";

export type AvatarRootProps = HTMLAttributes<"div">;

export type AvatarImageProps = HTMLAttributes<"img">;

export interface AvatarFallbackProps extends HTMLAttributes<"span"> {
  /** How long to wait before showing the fallback, in milliseconds. */
  delay?: number;
}

export interface AvatarLoadingStatusChangeDetail {
  status: ImageLoadingStatus;
}

export type AvatarLoadingStatusChangeEvent =
  CustomEvent<AvatarLoadingStatusChangeDetail>;

export interface OrmoAvatarElement extends HTMLElement {
  readonly imageLoadingStatus: ImageLoadingStatus;
}

declare global {
  interface HTMLElementTagNameMap {
    "ormo-avatar": OrmoAvatarElement;
  }

  interface GlobalEventHandlersEventMap {
    "ormo:avatar-loading-status-change": AvatarLoadingStatusChangeEvent;
  }
}
