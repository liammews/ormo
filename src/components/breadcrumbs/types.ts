import type { HTMLAttributes } from "astro/types";

export interface BreadcrumbsRootProps extends HTMLAttributes<"nav"> {
  /**
   * Accessible name for the navigation landmark. Ignored when
   * `aria-labelledby` is provided. Defaults to `"Breadcrumb"`.
   */
  label?: string;
  /**
   * When `true`, annotate the trail with Schema.org `BreadcrumbList`
   * microdata for search engines.
   */
  microdata?: boolean;
}

export type BreadcrumbsListProps = HTMLAttributes<"ol">;

export type BreadcrumbsItemProps = HTMLAttributes<"li">;

export interface BreadcrumbsLinkProps extends HTMLAttributes<"a"> {
  href: string;
  /**
   * When `true`, marks this link as the current page with
   * `aria-current="page"`. Prefer `Breadcrumbs.Page` for a non-link current
   * crumb.
   */
  current?: boolean;
  /**
   * Explicit Schema.org `name` for microdata mode. When set, emits a
   * `<meta itemprop="name">` sibling instead of wrapping the slot in a
   * `<span itemprop="name">`.
   */
  name?: string;
}

export interface BreadcrumbsPageProps extends HTMLAttributes<"span"> {
  /**
   * Explicit Schema.org `name` for microdata mode. When set, emits a
   * `<meta itemprop="name">` sibling instead of putting `itemprop="name"` on
   * the page element.
   */
  name?: string;
}

export type BreadcrumbsSeparatorProps = HTMLAttributes<"li">;
