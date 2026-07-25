# Ormo Design Decisions

This file records product and technical decisions that affect Ormo's public API, repository structure, or long-term maintenance. Add a new entry when a decision changes the direction of the project. If a decision is reversed, mark it as superseded and link to the replacement rather than deleting the history.

Statuses:

- **Accepted** — the current direction.
- **Proposed** — likely direction, but not yet committed.
- **Superseded** — replaced by a later decision.

## GD-001: Separate primitives, documentation, and premium themes

- **Date:** 2026-07-17
- **Status:** Superseded by GD-011

### Decision

Maintain independent repositories for:

- `ormo.primitives`: the public `@ormo/primitives` package.
- `ormo.docs`: the public documentation website.
- `ormo.themes`: a future premium themed package and private source repository.

The documentation should consume released package versions rather than sharing a production workspace with the primitives.

### Rationale

The primitives have an open-source contribution and release lifecycle, while the documentation and premium product have different deployment, branding, access, and commercial requirements. Separate repositories keep those concerns independent.

### Consequences

- Cross-repository changes require coordinated pull requests or prereleases.
- The primitives repository retains tests and fixtures needed to validate behavior.
- The docs repository documents versions users can actually install.
- Before the first npm release, the docs use a temporary local `link:../ormo.primitives` dependency.

## GD-002: Astro components with a custom-element runtime

- **Date:** 2026-07-17
- **Status:** Accepted

### Decision

Build primitives from Astro components that render semantic server-side HTML and small standards-based custom elements that provide browser behavior.

Do not require React, Vue, Solid, or another hydrated UI runtime.

### Rationale

This preserves Astro's server-first model, avoids framework hydration overhead, and gives consumers framework-independent DOM APIs and events.

### Consequences

- Astro components establish initial state and markup.
- Browser properties and custom events provide post-load control.
- Runtime modules must guard custom-element registration and support reconnecting elements.
- Interactive primitives still require JavaScript for client-side state changes.

## GD-003: Composable primitive anatomy

- **Date:** 2026-07-17
- **Status:** Accepted

### Decision

Expose primitives as composable parts imported through a component namespace. The Accordion API is the initial reference:

```astro
---
import * as Accordion from "@ormo/primitives/accordion";
---

<Accordion.Root>
  <Accordion.Item value="item-1">
    <Accordion.Header>
      <Accordion.Trigger>Question</Accordion.Trigger>
    </Accordion.Header>
    <Accordion.Content>Answer</Accordion.Content>
  </Accordion.Item>
</Accordion.Root>
```

Prefer Astro-native composition, props, and slots over attempting to reproduce React-specific APIs such as `asChild`.

### Rationale

Composable parts give consumers control over structure and styling while keeping accessibility relationships and behavior inside the primitive.

### Consequences

- Each part forwards applicable native HTML attributes.
- Polymorphism is added only where Astro can represent it clearly, such as the Accordion Header's `as` prop.
- New primitives should follow consistent `Root`, `Trigger`, `Content` or `Panel`, and component-specific part naming.

## GD-004: Consumer-owned classes and library-owned state attributes

- **Date:** 2026-07-17
- **Status:** Accepted

### Decision

Consumers style primitive parts by passing their own `class` values. Ormo does not expose `data-part` as a styling API and does not assign visual class names.

Ormo exposes behavioral state through attributes such as:

- `data-state="open"` and `data-state="closed"`
- `data-disabled`
- `data-orientation`

Attributes prefixed with `data-ormo-*` are internal runtime selectors and are not public styling hooks.

### Rationale

This mirrors the Radix model: consumers own visual naming, while the primitive owns stable behavioral state. It avoids global class-name opinions and keeps internal DOM discovery separate from the public styling contract.

### Consequences

```astro
<Accordion.Trigger class="accordion-trigger"> Question </Accordion.Trigger>
```

```css
.accordion-trigger[data-state="open"] {
  font-weight: 600;
}
```

- Removing or renaming a public state attribute is a breaking change.
- Internal `data-ormo-*` attributes may change without being treated as styling API changes.

## GD-005: Icons belong to consumers and themed layers

- **Date:** 2026-07-17
- **Status:** Accepted

### Decision

Behavioral primitives do not bundle an icon library and do not add Accordion-specific icon or indicator parts. Consumers place inline SVGs or Astro icon components inside triggers.

Decorative icons must use `aria-hidden="true"`. Their visual state should respond to the trigger's state attribute.

```astro
<Accordion.Trigger class="accordion-trigger">
  <span>Question</span>
  <ChevronDown class="accordion-icon" aria-hidden="true" />
</Accordion.Trigger>
```

```css
.accordion-trigger[data-state="open"] .accordion-icon {
  transform: rotate(180deg);
}
```

The future premium themed layer may provide a default icon with an override slot.

### Rationale

Icons are visual choices rather than Accordion behavior. Keeping them outside the primitive avoids an icon dependency, reduces bundle coupling, and allows consumers to use their existing icon system.

### Consequences

- Primitive examples may use inline SVGs without adding a package dependency.
- The premium package can make an opinionated icon choice.
- Icon accessibility remains the responsibility of the composition that provides the icon.

## GD-006: Headless primitives and behavior-critical styles only

- **Date:** 2026-07-17
- **Status:** Accepted

### Decision

`@ormo/primitives` is unstyled. It may include only behavior-critical presentation, such as hiding a closed panel when required for correct interaction.

Visual layout, colors, typography, borders, shadows, and motion belong to consumers or the future themed package.

### Rationale

The primitives should be suitable as an accessibility and behavior foundation for unrelated design systems.

### Consequences

- Documentation previews provide page-local example styles.
- Premium themes compose the same primitives rather than forking their behavior.
- Any CSS shipped by the primitives must be justified by behavior, not aesthetics.

## GD-007: Open primitives and proprietary premium themes

- **Date:** 2026-07-17
- **Status:** Proposed

### Decision

Keep `@ormo/primitives` open source under MIT. Distribute the future `@ormo/themes` package under a proprietary commercial license from a private repository or registry.

The likely commercial model is developer-seat licensing with use in commercial end products, while prohibiting source redistribution, resale, sublicensing, credential sharing, and competing source libraries.

### Rationale

An open behavioral foundation encourages adoption, while a maintained themed layer, templates, support, and design assets can fund development.

### Consequences

- Final commercial terms require review by a software licensing attorney.
- Runtime DRM should be avoided; entitlement checks should happen at download or installation time.
- Contributor agreements and third-party notices must preserve the right to distribute premium code commercially.
- Exact plans, update terms, and distribution infrastructure remain undecided.

## GD-008: Consumer-styled presence transitions

- **Date:** 2026-07-17
- **Status:** Superseded by GD-009

### Decision

Provide a reusable runtime presence lifecycle using `data-starting-style` and `data-ending-style`, delaying `hidden` until exit animations finish.

### Rationale

This allowed consumer-owned enter and exit animations without immediately changing content to `display: none`.

### Consequences

This introduced animation lifecycle behavior and additional public state attributes into the primitives runtime. GD-009 removes that infrastructure in favor of immediate visibility updates.

## GD-009: Immediate accordion content visibility

- **Date:** 2026-07-17
- **Status:** Superseded by GD-010

### Decision

Accordion content uses its `data-state` attribute for public state and applies `hidden` immediately when closed. Ormo does not expose presence-specific starting or ending style attributes.

Consumers may animate the immediate `hidden` change with browser CSS features such as discrete `display` transitions and `@starting-style`. The primitive runtime does not delay visibility changes to coordinate visual motion.

### Rationale

Immediate `hidden` behavior keeps the primitive runtime small and predictable while preserving the separation between library-owned behavior and consumer-owned motion.

### Consequences

- Closing content becomes hidden immediately from the primitive's perspective.
- Consumer exit animations depend on browser support for discrete display transitions or another consumer-managed technique.
- A reusable presence lifecycle may be reconsidered later, but would require a new decision and public API review.

## GD-010: Measured, consumer-styled collapsible motion

- **Date:** 2026-07-17
- **Status:** Accepted

### Decision

Accordion content opens and closes without consumer CSS. To support optional cross-browser motion without prescribing visual styles, the runtime measures the panel and exposes `--ormo-accordion-content-height` together with `data-starting-style` and `data-ending-style`.

When motion is authored, closing content remains rendered until its finite CSS transitions or animations finish. It becomes `aria-hidden` and `inert` immediately, and focus inside a closing panel returns to its trigger. Without authored motion, `hidden` is applied immediately.

### Rationale

A measured pixel height avoids relying on limited `interpolate-size` support and removes grid, discrete display, and native starting-style mechanics from consumer CSS. The runtime absorbs lifecycle complexity once so consumers only choose duration, easing, and other visual motion details.

### Consequences

- `--ormo-accordion-content-height`, `data-starting-style`, and `data-ending-style` are public styling APIs.
- Panel spacing should live on an inner content element so the animated panel can reach zero height.
- Dimension reads occur once at transition boundaries; the panel returns to automatic height after opening.
- Interrupted and reduced-motion transitions must resolve without leaving stale visibility state.
- The primitive package continues to ship no visual CSS.

## GD-011: Colocate primitives and public documentation

- **Date:** 2026-07-17
- **Status:** Accepted

### Decision

Maintain the public documentation site in `ormo.docs` within the `ormo.primitives` repository. The repository is a pnpm workspace, and the private docs package consumes `@ormo/primitives` through `workspace:*`.

The future premium themed package remains a separate private package or repository.

### Rationale

The documentation and its demos are part of the open-source developer experience. Colocating them allows component, demo, and documentation changes to be reviewed and validated together while retaining a clear package boundary for publishing primitives.

### Consequences

- One lockfile and root CI workflow cover the library and documentation.
- Root validation checks both projects.
- Documentation can use unreleased workspace changes during development.
- The docs package remains private and is not published to npm.
- Public docs examples must remain synchronized with the package API.

## GD-012: Accordion triggers stay in the normal Tab sequence

- **Date:** 2026-07-23
- **Status:** Accepted

### Decision

Accordion triggers are native buttons in the document Tab order. Ormo does not implement WAI-ARIA Accordion pattern arrow-key roving tabindex, and it does not handle Home or End keys inside the Accordion.

Activation uses the native button keys: Enter and Space.

### Rationale

Keeping triggers in the normal Tab sequence matches Ormo's preference for platform behaviour over recreating composite widget keyboard models. Arrow-key navigation would require managing focus among triggers, skipping disabled items, and choosing orientation-specific bindings. That complexity is unnecessary for the common FAQ and settings layouts Accordion targets, and it conflicts with the deprecated styling-only `orientation` prop.

Documenting the deviation is preferable to silently diverging from APG while still claiming full composite-widget behaviour.

### Consequences

- Keyboard users Tab between Accordion triggers like any other buttons on the page.
- Screen-reader users still receive `aria-expanded` and `aria-controls` relationships.
- Projects that need APG arrow-key behaviour must add it in application code or a wrapper.
- Docs and tests assert that Arrow, Home, and End are left to the browser.

## GD-013: Popover uses the Popover API, CSS anchors by default, and opt-in Floating UI

- **Date:** 2026-07-23
- **Status:** Accepted

### Decision

Ormo Popover is a non-modal, click-triggered overlay for rich interactive content.

- Open, dismiss, and top-layer behaviour use the native HTML Popover API (`popover="auto"` by default).
- Default placement uses CSS Anchor Positioning driven by Content `side`, `align`, and `sideOffset`.
- Floating UI is opt-in only: import `@ormo/primitives/popover/floating` from an Astro client `<script>` (not the frontmatter) and set `positioning="floating"` on Root. The default popover entry must not load Floating UI.
- Hover/focus open and delay belong to future Tooltip / HoverCard primitives, not Popover.
- Modal interruption remains Dialog / Alert Dialog. Popover does not trap focus, set `aria-modal`, or lock page scroll.
- Triggers are native buttons with slot content. Ormo does not implement Radix `asChild` or Base UI `render` prop merging.

### Rationale

The Popover API provides light dismiss, Escape, and top-layer rendering without making the page inert. CSS Anchor Positioning is the platform placement model and keeps the default path free of positioning JavaScript. Floating UI remains available for consumers who need broader browser coverage or advanced collision behaviour, but only when they opt in explicitly. Separating hover-triggered overlays preserves WCAG 1.4.13 responsibilities for those patterns and keeps Popover focused on intentional click open.

### Consequences

- Without CSS Anchor support, default placement falls back to the user-agent top-layer default (typically centered). Docs point consumers to the Floating UI opt-in when that matters.
- `positioning="floating"` without the floating import warns in development and keeps CSS Anchor Positioning until the floating entry is loaded.
- `@floating-ui/dom` is an optional peer dependency required only when using the floating entry.
- Portal, Backdrop, Arrow, separate Positioner/Popup/Viewport, and `asChild` are out of scope for the initial Popover.

## GD-014: Tabs follow the APG composite keyboard model

- **Date:** 2026-07-23
- **Status:** Accepted

### Decision

Ormo Tabs implements the WAI-ARIA Authoring Practices tabs pattern, including `tablist` / `tab` / `tabpanel` roles, roving tabindex among tabs, orientation-aware arrow keys, and Home / End. Manual activation is the default (`activateOnFocus={false}`); automatic activation is opt-in.

This deliberately differs from Accordion (GD-012), which keeps triggers in the normal document Tab sequence without arrow-key roving focus.

### Rationale

HTML has no native tabs widget. Screen reader and keyboard users expect the established composite tabs pattern: Tab enters the selected tab, arrows move within the tablist, and Tab leaves to the panel. Matching APG is correctness for Tabs, whereas Accordion’s common FAQ and settings layouts are better served by ordinary buttons in Tab order.

### Consequences

- Tabs requires a custom-element runtime for selection, ARIA relationships, and keyboard behaviour.
- Docs and tests assert arrow-key navigation, Home / End, and roving tabindex.
- Accordion and Tabs remain intentionally different keyboard models; wrappers must not assume one policy for both.

## GD-015: Tooltip is interest-triggered, top-layer, and non-interactive

- **Date:** 2026-07-25
- **Status:** Accepted

### Decision

Ormo Tooltip shows brief non-interactive descriptions on hover and keyboard focus.

- Parts are `Root`, `Trigger`, and `Content` only. Trigger is a native button; detached triggers use `for` → Root `id` (same association model as Popover). External interest-target binding is out of scope for v1.
- Content uses `role="tooltip"`. Triggers receive `aria-describedby` only while open. Focus never moves into Content. Focusable descendants are a development warning — interactive overlays belong on Popover or a future HoverCard.
- Open/close timing uses Root `delay` (default 700ms for pointer; focus opens immediately) and `closeDelay` (default 100ms) so Content remains hoverable for WCAG 1.4.13. A page-level skip-delay grace period (~300ms) opens the next tooltip immediately after one closes. There is no Provider part.
- Content uses the Popover API for top-layer rendering: `popover="hint"` when supported, otherwise `popover="manual"`. Interest timing, Escape dismiss, exclusive open, and hoverability are owned by the runtime. No dedicated long-press/touch path in v1.
- Placement mirrors Popover: CSS Anchor Positioning by default; Floating UI is opt-in via `import "@ormo/primitives/tooltip/floating"` and `positioning="floating"`.
- There is no Astro `open` prop. Post-render control uses the `ormo-tooltip` DOM API (`open`, `show()`, `hide()`, `ormo:tooltip-open-change`).

### Rationale

Native `title` fails WCAG 1.4.13. Interest Invokers are not yet cross-browser, so a dependable runtime is required while still using the Popover API for stacking. Separating Tooltip from Popover keeps click-triggered interactive content distinct from ephemeral descriptions and preserves the correct ARIA pattern.

### Consequences

- Tooltips describe Trigger buttons (including detached Triggers), not arbitrary existing controls.
- Consumers must not place links or other tabstops inside Content.
- Without CSS Anchor support, default placement falls back like Popover; Floating UI remains the opt-in escape hatch.
- HoverCard remains a separate future primitive for richer hover content.

## Entry template

```md
## GD-XXX: Decision title

- **Date:** YYYY-MM-DD
- **Status:** Proposed | Accepted | Superseded by GD-XXX

### Decision

What was decided.

### Rationale

Why this direction was chosen.

### Consequences

What this enables, constrains, or requires.
```
