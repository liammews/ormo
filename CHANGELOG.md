# @ormo/primitives

## 0.1.0-beta.0

### Minor Changes

- e0e80fd: Improve Accordion SSR initial state, browser control surface, and diagnostics.

  Reflect `defaultValue` and root `hiddenUntilFound` in server HTML, expose `type` on the custom element, keep authored trigger `disabled` in sync after mount, and warn about incomplete or duplicated Accordion parts in the dev toolbar.

  Make single Accordions collapsible by default. Require an always-open panel with `collapsible={false}`.

- 00f813c: Add the beta Autocomplete primitive with freeform text, local and externally
  managed suggestions, async loading states, native form behaviour, accessible
  keyboard navigation, and optional Floating UI positioning.
- 00f813c: Add a beta, progressively enhanced, locally filtered Combobox primitive with a
  native form fallback, grouped items, constrained selection, and optional
  Floating UI positioning.
- 22051b1: Add a native-first Meter primitive with bounded scalar values, range
  thresholds, accessible naming, and zero-JavaScript semantics.
- 22051b1: Add the Navigation Menu primitive for accessible site navigation links and dropdown disclosures, with CSS Anchor Positioning and optional Floating UI collision handling.
- 7429fee: Add a Password Field primitive with a native password input, an accessible
  visibility toggle, secure masked fallbacks, Field composition, and a browser
  visibility API.
- 72c2470: Add a production-ready Progress primitive with native determinate and
  indeterminate states, accessible naming, value text, and zero-JavaScript
  semantics.
- 613c807: Add a composable `Select.ItemIndicator` part for rendering real selected-item
  icons without generated CSS content. Close the popup when the selected item is
  activated, measure the trigger before opening to prevent an initial popup-width
  shift, and promote Select to beta.
- a58ec56: Add a beta, static Separator primitive with horizontal and vertical
  orientation, semantic and decorative output, and an orientation styling hook.
- 22051b1: Add a native-first Slider primitive with single and multi-thumb values,
  controlled state, forms, orientation, RTL behaviour, and accessible range
  inputs.
- aadc34d: Add a native-input-backed Switch primitive with composed state, form support,
  readonly behaviour, cancellable events, and a decorative Thumb part.
- d19ba93: Add production-ready Toggle and Toggle Group primitives with native buttons,
  controlled and uncontrolled state, cancellable reasoned changes, form
  association, disabled inheritance, authored-state restoration, and shared
  collection keyboard navigation.
- 415e963: Add an Avatar primitive with Image and Fallback loading coordination.

  Compose Root, Image, and Fallback to show a profile image when available and initials or a consumer-owned icon otherwise, with accessible naming left to authors per WCAG 1.1.1.

- 04a10d0: Add the Breadcrumbs primitive.

  Ship a zero-JavaScript `nav` / `ol` trail with `Root`, `List`, `Item`, `Link`, `Page`, and `Separator`, plus an opt-in Schema.org `BreadcrumbList` microdata mode.

- 872e840: Add an accessible Alert Dialog primitive built on the native modal dialog element, with composable parts, descendant and detached Triggers, shared background scroll locking, hardened focus management, explicit focus restoration, transition state, nested-dialog support, pending Button interoperability, Astro navigation handling, development diagnostics, demos, and documentation.
- 872e840: Add a Button primitive with native and accessible non-native rendering, disabled and pending state control, a zero-JavaScript native production path, development accessibility diagnostics, demos, and documentation.
- d283afe: Add Checkbox, CheckboxIndicator, CheckboxGroup, and Fieldset primitives.

  Ship a native checkbox with an optional indicator, one-shot indeterminate initialisation, a role=group custom element for shared and authored names, parent select-all, SSR aggregate state, native form reset, reasoned browser value-change events, browser value control, and at-least-one validation, plus a zero-JavaScript native Fieldset and Legend. Field can own a checkbox group for description and error wiring.

- 04c5a69: Harden Fieldset with optional development-toolbar diagnostics for missing, misplaced, empty, and duplicated Legend parts. Expand native DOM, disabled-cascade, form-association, no-JavaScript, and accessibility coverage, and add complete demos and component documentation.
- 872e840: Add an accessible modal Dialog primitive built on the native dialog element, with composable parts, descendant and detached Triggers, cancellable pointer, Close, and Escape dismissal requests, shared background scroll locking, hardened focus and DOM lifecycle management, transition state, framework-independent control, development diagnostics, demos, and documentation.
- 04c5a69: Harden Input as a native text-entry primitive.

  Compose Input with Field relationships during server rendering, share the
  Field.Control implementation, narrow the public type to text-entry input types,
  add development diagnostics for missing accessible names, and cover native
  form, validation, state, accessibility, and no-JavaScript behaviour.

- 44b0e56: Add an accessible non-modal Popover primitive on the HTML Popover API with CSS Anchor Positioning by default, optional Floating UI placement, composable parts, demos, and documentation.
- b4443c1: Add native Radio and RadioIndicator primitives plus an enhanced RadioGroup.

  RadioGroup provides SSR default selection and labels, live name, disabled, and
  required inheritance, a framework-independent value and validity API, reasoned
  value-change events, and Field integration while retaining native radio
  keyboard, validation, reset, and form behaviour.

- 73a9b0c: Make closed Accordion content discoverable with the browser’s Find in page feature by default.

  Set `hiddenUntilFound={false}` on `Accordion.Root` to opt out for every panel, or on an individual `Accordion.Content` to override the Root setting for that panel.

- 7281644: Add a custom-by-default Select primitive with an operating-system `native` mode, native form fallback, accessible groups, separators, clearing, typeahead, browser control, and optional Floating UI positioning.
- 04c5a69: Harden Field with native-first server-rendered form semantics, resilient cancellable custom validation, form-wide asynchronous submit coordination, live state reconciliation, and complete component documentation. The state event is now `ormo:field-state-change`, and validator failures emit `ormo:field-validation-error`.
- ed7c0f1: Add a Tabs primitive with List, Tab, and Panel parts.

  Compose an accessible tablist that selects one panel at a time, with APG keyboard behaviour, orientation, and optional activate-on-focus.

- 913e8ed: Add an accessible Tooltip primitive for hover and focus descriptions, with Popover API top-layer rendering, CSS Anchor Positioning by default, optional Floating UI placement, composable parts, demos, and documentation.

### Patch Changes

- b0dd226: Add the Dropdown Menu primitive.
- 89cd009: Add the Number Field primitive.
- b0dd226: Add the Preview Card primitive.
- b2945dd: Harden Button disabled/pending behavior: persist focusableWhenDisabled, set aria-busy for pending, guard aria-disabled form submits, infer non-native rendering from as, and add browser coverage — while keeping the default native Button JavaScript-free.
- f96de31: Remove the deprecated Accordion `orientation` prop and `data-orientation` styling metadata.
- 9c619de: Promote all current primitives to production status after completing their API,
  accessibility, fallback, lifecycle, package, size, and cross-browser readiness
  audits.
- 8d718fa: Hide decorative enhanced Select separators from the accessibility tree so listboxes expose only permitted option and group children.
- b29853b: Decode complete HTML entities in Select’s server-rendered text values and
  restore authored attributes, styles, and value text when enhanced Select roots
  disconnect.
- 4ba8da4: Support left and right Select placement with the default CSS anchor positioner, restore authored trigger `anchor-name` styles when Popover and Tooltip release a trigger, and expose shared `ormo:value-change` event typing from every emitting component subpath.
