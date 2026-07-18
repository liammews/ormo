# GoodUI Design Decisions

This file records product and technical decisions that affect GoodUI's public API, repository structure, or long-term maintenance. Add a new entry when a decision changes the direction of the project. If a decision is reversed, mark it as superseded and link to the replacement rather than deleting the history.

Statuses:

- **Accepted** — the current direction.
- **Proposed** — likely direction, but not yet committed.
- **Superseded** — replaced by a later decision.

## GD-001: Separate primitives, documentation, and premium themes

- **Date:** 2026-07-17
- **Status:** Superseded by GD-011

### Decision

Maintain independent repositories for:

- `goodui.primitives`: the public `@goodui/primitives` package.
- `goodui.docs`: the public documentation website.
- `goodui.themes`: a future premium themed package and private source repository.

The documentation should consume released package versions rather than sharing a production workspace with the primitives.

### Rationale

The primitives have an open-source contribution and release lifecycle, while the documentation and premium product have different deployment, branding, access, and commercial requirements. Separate repositories keep those concerns independent.

### Consequences

- Cross-repository changes require coordinated pull requests or prereleases.
- The primitives repository retains tests and fixtures needed to validate behavior.
- The docs repository documents versions users can actually install.
- Before the first npm release, the docs use a temporary local `link:../goodui.primitives` dependency.

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
import * as Accordion from "@goodui/primitives/accordion";
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

Consumers style primitive parts by passing their own `class` values. GoodUI does not expose `data-part` as a styling API and does not assign visual class names.

GoodUI exposes behavioral state through attributes such as:

- `data-state="open"` and `data-state="closed"`
- `data-disabled`
- `data-orientation`

Attributes prefixed with `data-goodui-*` are internal runtime selectors and are not public styling hooks.

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
- Internal `data-goodui-*` attributes may change without being treated as styling API changes.

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

`@goodui/primitives` is unstyled. It may include only behavior-critical presentation, such as hiding a closed panel when required for correct interaction.

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

Keep `@goodui/primitives` open source under MIT. Distribute the future `@goodui/themes` package under a proprietary commercial license from a private repository or registry.

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

Accordion content uses its `data-state` attribute for public state and applies `hidden` immediately when closed. GoodUI does not expose presence-specific starting or ending style attributes.

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

Accordion content opens and closes without consumer CSS. To support optional cross-browser motion without prescribing visual styles, the runtime measures the panel and exposes `--goodui-accordion-content-height` together with `data-starting-style` and `data-ending-style`.

When motion is authored, closing content remains rendered until its finite CSS transitions or animations finish. It becomes `aria-hidden` and `inert` immediately, and focus inside a closing panel returns to its trigger. Without authored motion, `hidden` is applied immediately.

### Rationale

A measured pixel height avoids relying on limited `interpolate-size` support and removes grid, discrete display, and native starting-style mechanics from consumer CSS. The runtime absorbs lifecycle complexity once so consumers only choose duration, easing, and other visual motion details.

### Consequences

- `--goodui-accordion-content-height`, `data-starting-style`, and `data-ending-style` are public styling APIs.
- Panel spacing should live on an inner content element so the animated panel can reach zero height.
- Dimension reads occur once at transition boundaries; the panel returns to automatic height after opening.
- Interrupted and reduced-motion transitions must resolve without leaving stale visibility state.
- The primitive package continues to ship no visual CSS.

## GD-011: Colocate primitives and public documentation

- **Date:** 2026-07-17
- **Status:** Accepted

### Decision

Maintain the public documentation site in `goodui.docs` within the `goodui.primitives` repository. The repository is a pnpm workspace, and the private docs package consumes `@goodui/primitives` through `workspace:*`.

The future premium themed package remains a separate private package or repository.

### Rationale

The documentation and its demos are part of the open-source developer experience. Colocating them allows component, demo, and documentation changes to be reviewed and validated together while retaining a clear package boundary for publishing primitives.

### Consequences

- One lockfile and root CI workflow cover the library and documentation.
- Root validation checks both projects.
- Documentation can use unreleased workspace changes during development.
- The docs package remains private and is not published to npm.
- Public docs examples must remain synchronized with the package API.

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
