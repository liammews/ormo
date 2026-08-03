# Beta components audit

Date: 30 July 2026

## Purpose

This audit reviews every primitive currently marked `beta` in
`primitive-contracts.json` before work moves to the remaining primitives. It
looks for confirmed bugs, credible implementation risks, obvious missing
features, missing public demos, and untested behaviour.

The audit covers:

- Accordion
- Alert Dialog
- Avatar
- Breadcrumbs
- Button
- Checkbox
- Dialog
- Field
- Fieldset
- Input
- Popover
- Radio
- Select
- Tabs
- Tooltip

The review used the component source, runtime source, SSR contexts, public
types, documentation pages, public demos, browser fixtures, unit tests, Astro
render tests, browser tests, the primitive contract manifest, and CI workflow.

## Executive summary

The beta collection is in good condition. No currently reproducible,
release-blocking runtime bug was found during this audit. The strongest
primitives—Dialog, Alert Dialog, Checkbox, Radio, Field, Popover, and
Button—already have unusually deep coverage for lifecycle, forms,
accessibility relationships, cancellation, and dynamic state.

The principal concern is uneven evidence rather than visibly broken behaviour.
Several APIs document behaviour that is covered only in unit tests, and some
custom elements have no focused tests for removal, reconnection, or live part
mutation. Responsive browser coverage is also inconsistent.

The recommended next step is a short beta-hardening phase before starting the
remaining components. It should focus on shared lifecycle tests, cross-browser
gating, and a small number of missing public demos. It should not become a
feature-expansion project.

### Readiness assessment

| Area | Assessment | Notes |
| --- | --- | --- |
| Public API | Good | APIs are typed and documented; no major redesign is indicated. |
| Accessibility semantics | Good | Every beta primitive has browser axe coverage and semantic render tests. |
| Keyboard interaction | Good | Complex widgets cover their principal keyboard paths. |
| Native forms | Very good | Button, Checkbox, Radio, Field, Fieldset, Input, and Select retain native form behaviour. |
| SSR and no-JavaScript | Good | Static and conditional-native primitives have explicit no-JS tests; some custom elements still need clearer degradation statements. |
| Lifecycle safety | Mixed | Dialog-like primitives are strong; Avatar, Popover, Tabs, and Tooltip need more focused teardown/reconnection evidence. |
| Dynamic composition | Mixed | Accordion and form groups are strong; Tabs, Select, Avatar, and overlay part replacement need more coverage. |
| Responsive behaviour | Mixed | Dialogs and Radio are covered; most other demos have no narrow-viewport assertion. |
| Cross-browser confidence | Good with a CI caveat | Full engines run after merge/on schedule, but pull requests gate only on Chromium. |
| Documentation and demos | Good | Coverage is broad, but several important advanced behaviours are code-only or test-only. |

## Priorities

### P0 — complete before moving on

These are repository-level confidence gaps, not confirmed component failures.

1. **Run Firefox and WebKit on pull requests for changed primitive browser
   specs.**

   Pull requests currently install and run only Chromium. Firefox and WebKit
   run on `main` pushes and the weekly schedule, which means an engine-specific
   regression can merge before it is detected. Either run all engines on every
   pull request or add a changed-path job for `src/components`, `src/runtime`,
   `src/internal`, public demos, and browser specs.

2. **Create a shared custom-element lifecycle test contract.**

   Every runtime-owning beta primitive should explicitly prove:

   - disconnect aborts listeners and observers;
   - reconnect does not duplicate events;
   - runtime-authored attributes and inline styles are restored where promised;
   - an open overlay is normalized when removed;
   - an Astro document swap closes or cleans up transient UI.

   Dialog and Alert Dialog provide the best existing examples. Apply the
   relevant subset to Accordion, Avatar, CheckboxGroup, Field, Popover,
   RadioGroup, Select, Tabs, and Tooltip.

3. **Add a narrow-viewport smoke test for every public demo fixture.**

   Only Alert Dialog, Dialog, and Radio have explicit narrow viewport or reflow
   checks. A shared 320 CSS-pixel smoke test should assert no horizontal page
   overflow and that the primary control remains visible and operable.

4. **Keep “confirmed bug” and “coverage gap” separate during remediation.**

   Most findings below are missing evidence. Do not change runtime behaviour
   solely to satisfy a hypothetical issue; first add a failing focused test or
   a reproduction.

### P1 — recommended beta hardening

1. Add public demos for the most important behaviours that are currently
   test-only: dialog forms/nesting, Field async validation, Select floating
   positioning, and dynamic Avatar sources.
2. Add live mutation tests to Tabs and Select.
3. Add explicit teardown/reconnection tests to Avatar, Popover, Tabs, and
   Tooltip.
4. Add browser form-reset coverage for Select and Checkbox groups rather than
   relying only on unit-level evidence.
5. Add a lightweight manual assistive-technology checklist for releases. Axe
   cannot verify announcements, focus reading order, or platform-specific
   combobox/dialog output.

### P2 — useful after the hardening pass

1. Add visual regression snapshots for open overlays, indicators, invalid
   states, and narrow layouts.
2. Add RTL fixtures for horizontal keyboard widgets and positioned overlays.
3. Add reduced-motion checks consistently across components that expose
   transition hooks.
4. Standardize demo form action sizing and result/error presentation.

## Cross-cutting findings

### Confirmed process issues

#### Full cross-browser testing is post-merge for pull requests

`.github/workflows/ci.yml` runs Chromium for pull requests and all engines for
non-pull-request events. This is efficient, but it is weaker than the beta
claim suggests for Popover API, CSS Anchor Positioning, native dialog, native
select, and form-control behaviour.

**Action:** make all three engines a required pull-request check, or introduce a
path-filtered cross-browser job.

#### The broad `docs/` ignore pattern also matches nested docs paths

The repository ignores `docs/`, and the pattern also affects explicit staging
of tracked files under `ormo.docs/src/pages/docs`. `git add -u` works, but
explicit `git add ormo.docs/src/pages/docs/...` reports the path as ignored.

This does not affect runtime quality, but it creates avoidable release and
documentation workflow friction.

**Action:** anchor the ignore rule to `/docs/`.

### Test architecture gaps

#### Automated accessibility coverage is broad but shallow by design

Every beta browser specification runs axe. This catches many semantic and
relationship failures, but not:

- whether screen readers announce value and expanded state as expected;
- whether async validation changes are announced at the right time;
- whether focus restoration is understandable in nested overlays;
- whether tooltip timing is usable with screen magnification;
- VoiceOver interaction with the custom Select;
- high-contrast and forced-colours rendering.

**Action:** add a release checklist covering NVDA/Firefox, VoiceOver/Safari,
keyboard-only use, 200% zoom, and forced colours for the complex primitives.

#### Responsive checks are inconsistent

Overlay surfaces can overflow even when their runtime positioning is correct,
and form demos can acquire intrinsic-width regressions. The recent Select demo
bugs illustrate why this should be a shared contract rather than a
component-specific reaction.

**Action:** add a reusable `expectNoHorizontalOverflow` browser helper and run
it against each public fixture at 320 CSS pixels.

#### Public demos and browser fixtures are appropriately shared

The browser fixtures import public demo components rather than maintaining
parallel test-only examples. This is a strong practice and should continue.
Where a public demo is excluded, the fixture generally documents why and points
to equivalent unit coverage.

### API consistency opportunities

The primitives use several event naming families:

- `ormo:value-change`
- `ormo:select-value-change`
- `ormo:dialog-before-close`
- `ormo:field-state-change`
- `ormo:avatar-loading-status-change`

These names are documented and not currently broken, but consumers must learn
several conventions.

**Action:** do not rename beta events casually. Record the conventions in the
codebase bible and apply one naming rule to new primitives.

The public custom-element APIs also differ in whether programmatic assignment
emits a custom event. This is documented per primitive, but deserves a small
comparison table in contributor documentation.

## Component findings

## Accordion

### Current strengths

- Covers single and multiple modes, required-open behaviour, disabled items,
  default state, browser find-in-page integration, public value events, live
  property changes, dynamic insertion, nested Accordions, focus preservation,
  SSR, no-JS output, and axe.
- Public demos cover all main author-facing configurations.
- Nested SSR and runtime scoping are explicitly tested.

### Potential issues and untested behaviour

- Dynamic insertion is tested, but dynamic removal and reordering are not.
- There is no focused disconnect/reconnect test proving that listeners and
  MutationObservers are not duplicated.
- Browser find-in-page behaviour has a public demo but cannot be exercised by
  Playwright; its unit coverage cannot prove real browser `beforematch`
  behaviour.
- The public value/property API is documented but lacks a dedicated controlled
  public demo.
- No narrow viewport or long-heading wrapping test exists.

### Missing or useful demos

- Programmatic value control.
- A long heading and rich panel content example.
- Dynamic item insertion/removal only if dynamic composition is intended as a
  promoted feature.

### Actions

1. Add removal/reorder and reconnect tests.
2. Add a controlled-value demo or explicitly keep the API documentation-only.
3. Add a manual find-in-page release check.

## Alert Dialog

### Current strengths

- One of the strongest primitives in the repository.
- Covers modal focus containment, Escape, initial and final focus, pending
  actions, action cancellation, native form submission, detached and multiple
  triggers, nested dialogs, transition lifecycle, reduced motion, content
  removal, movement, reconnection cleanup, responsive fit, and axe.
- Accessible name and description relationships are tested under live changes.

### Potential issues and untested behaviour

- The browser suite is comprehensive, but most axe coverage is concentrated on
  the default open state rather than pending, nested, and form variants.
- No forced-colours or 200% zoom assertion exists.
- Rapid open/close/open sequences are covered in one task, but action promise
  rejection and a trigger removed while an async action is pending are not
  obvious test cases.

### Missing or useful demos

- Nested Alert Dialog.
- Native form validation/action.
- Explicit final focus.
- Action rejection/service failure.

### Actions

1. Add axe checks to the pending and nested states.
2. Add a public native-form example.
3. Add one async rejection test and document expected ownership.

## Avatar

### Current strengths

- Covers loaded, loading, error, missing/whitespace source, delayed fallback,
  delay changes, source mutation, events, required alt text, nested SSR context,
  decorative use, and interactive wrappers.
- Public demos cover a wide range of presentation states.

### Potential issues and untested behaviour

- Only failed-image and interactive-wrapper demos run in a real browser.
- Delay timing, successful image load, source mutation, and rapid source
  changes are unit-only.
- No disconnect/reconnect test proves that pending timers and image listeners
  are cleaned up.
- Native responsive image attributes are forwarded, but `srcset`/`sizes`
  selection and a source change during an in-flight load are not browser
  tested.
- Layout stability is not asserted; fallback and image dimensions may differ
  in consumer styling.

### Missing or useful demos

- Live avatar source replacement.
- Responsive `srcset`/`sizes`.
- A fixed-size example showing how to prevent layout shift.

### Actions

1. Add timer/listener teardown and reconnect tests.
2. Add a real-browser successful load and rapid source-swap test using a local
   fixture image.
3. Document that consumers own fixed dimensions and object fitting.

## Breadcrumbs

### Current strengths

- Static native markup with no runtime risk.
- Covers landmark naming, current-page semantics, hidden separators,
  `aria-labelledby`, structured-data positions, nested SSR counters, no-JS
  output, and axe.
- Public demos closely match the test surface.

### Potential issues and untested behaviour

- There are no development diagnostics for multiple current pages, an empty
  list, or a `Page` outside a `List`.
- Structured data is asserted structurally but not run through a schema
  validator.
- Long trails, wrapping, truncation, and horizontal overflow are styling
  concerns with no demo or browser check.
- Nested breadcrumb trails are context-tested but not presented publicly.

### Missing or useful demos

- A long responsive trail with collapsed middle items.
- An icon/home-link first item.

### Actions

1. Decide whether invalid composition warrants diagnostics; do not add runtime.
2. Add a long-trail responsive demo and overflow test.
3. Optionally validate the structured-data demo in a schema test.

## Button

### Current strengths

- Very deep keyboard and disabled-state coverage.
- Correctly handles native and non-native rendering, Enter/Space activation,
  stopped propagation, cancellation, submit guarding, pending state,
  focusable-disabled controls, restoration of authored tabindex, no-JS safety,
  diagnostics, and axe.
- Native semantics remain the default.

### Potential issues and untested behaviour

- Pointer cancellation scenarios—pointer down inside, release outside—are left
  to native click behaviour and are not explicitly covered for non-native
  buttons.
- Pending state is demonstrated statically; live pending transitions and label
  replacement are not a public demo.
- There is no narrow layout test for long labels or icon/label combinations.
- `setButtonState` is documented, but consumers may not know when to prefer
  component props versus the runtime helper.

### Missing or useful demos

- Icon plus text.
- Live async pending transition.
- Full-width/long-label responsive button.

### Actions

1. Add a live pending demo.
2. Add a browser assertion that pending changes do not lose the accessible
   name.
3. Clarify the intended use of `setButtonState`.

## Checkbox

### Current strengths

- Extensive native, group, parent, validation, form, Field integration,
  dynamic name/label, reset, disabled-fieldset, indeterminate, event, no-JS,
  and axe coverage.
- The documentation clearly states the no-JS limitations of parent and group
  coordination.
- Native input state remains the source of truth.

### Confirmed limitation

- Nested parent-checkbox trees are explicitly unsupported.

This is acceptable for beta if retained in the docs. It becomes a missing
feature only if upcoming product work needs nested permission/category trees.

### Potential issues and untested behaviour

- Dynamic name changes are covered, but inserting, removing, and moving members
  between live groups needs a focused browser test.
- Group-required validation disappears without JavaScript by design. The docs
  disclose this, but the no-JS browser test does not explicitly demonstrate the
  limitation.
- Form reset is deeply tested, but a public reset demo is absent.
- No narrow viewport test exists for large checkbox groups or long labels.
- Forced-colours rendering of custom indicators is not checked.

### Missing or useful demos

- Form reset.
- Dynamically managed members, if supported as a public use case.
- Forced-colours-friendly custom indicator styling.

### Actions

1. Add live insertion/removal/move tests.
2. Add a public reset example.
3. Add a forced-colours styling check.
4. Keep nested parent groups explicitly out of scope or design them as a
   separate future feature.

## Dialog

### Current strengths

- Very mature modal behaviour: focus containment/restoration, Escape and
  outside dismissal, cancellation, detached triggers, nested dialogs, native
  dialog forms, return values, scroll locking, initial/final focus, live
  accessible relationships, content removal, moved roots, reconnection,
  responsive fit, and axe.
- Recent accessible-name reconciliation work closes an important live-state
  edge case.

### Potential issues and untested behaviour

- Public demos cover only default, persistent pointer behaviour, and detached
  triggers. Many of the best-supported capabilities are code-only or test-only.
- Axe is not explicitly run against nested and native-form dialog states.
- There is no reduced-motion lifecycle browser test comparable to Alert
  Dialog.
- Multiple dialogs competing to lock scroll are tested through nesting, but a
  dialog removed during a CSS transition deserves an explicit regression test.

### Missing or useful demos

- Native `<form method="dialog">`.
- Nested dialog.
- Unsaved-changes dismissal cancellation.
- Structured-content initial focus.
- Explicit final focus.

### Actions

1. Add a native form demo first; it communicates a major reason to use native
   `<dialog>`.
2. Add reduced-motion and transition-removal coverage.
3. Run axe against nested and form variants.

## Field

### Current strengths

- Exceptionally broad state and validation coverage.
- Covers native validity reasons, synchronous and asynchronous validators,
  abort signals, form data, thrown failures, debounce, submit/blur/change
  modes, form reset, invalid focus, dynamic parts, replacement controls,
  CheckboxGroup and RadioGroup ownership, SSR, and axe.
- Documentation clearly distinguishes native and enhanced behaviour.

### Potential issues and untested behaviour

- The most complex feature—async custom validation—has no public interactive
  demo and only one browser scenario.
- There is no explicit no-JS browser test even though the docs make detailed
  degradation claims. Native controls are tested elsewhere, but Field’s own
  SSR relationships deserve a direct check with JavaScript disabled.
- Race handling is unit-tested through abort signals, but rapid typing and
  out-of-order network resolution are not browser-tested.
- No live demo covers form reset or changing validation mode.
- No narrow viewport check exists for long error text.

### Missing or useful demos

- Async username validation using a deterministic local mock.
- Form reset.
- CheckboxGroup/RadioGroup wrapped by Field.
- Multiple reason-specific error messages.

### Actions

1. Add an interactive async-validation demo and browser test.
2. Add a Field-specific no-JS test.
3. Add narrow layout coverage for long errors.
4. Add a stale-result browser regression test.

## Fieldset

### Current strengths

- Uses native fieldset and legend semantics.
- Covers disabled cascading, external form association, native APIs,
  diagnostics, no-JS output, and axe.
- Very small runtime risk because the primitive is static.

### Potential issues and untested behaviour

- Long legends and narrow layouts are not tested.
- Nested fieldsets are neither demonstrated nor specifically checked.
- The “related choices” documentation is code-only.
- Diagnostics enforce direct-child ordering in development, but there is no
  browser fixture proving diagnostics do not leak into production.

### Missing or useful demos

- Nested fieldsets for hierarchical forms.
- Long legend/help text.
- A richer related-choice layout.

### Actions

1. Add narrow/long-legend coverage.
2. Decide and document whether nested fieldsets are an encouraged composition.
3. Add a production-build diagnostic absence assertion if this is not already
   covered globally.

## Input

### Current strengths

- Intentionally thin native wrapper.
- Covers attribute forwarding, Field composition, native value/events/forms,
  required validity, readonly, disabled, SSR, no-JS, diagnostics, theme
  contrast, and axe.
- Explicitly restricts the primitive to supported text-entry input types.

### Potential issues and untested behaviour

- Supported type coverage is mostly type-level/render-level rather than a
  browser matrix across email, number, date, password, search, tel, time, URL,
  and week.
- Browser autofill/autocomplete behaviour is not tested.
- No datalist demo exists.
- Number/date browser behaviour differs significantly by engine and locale.
- File, range, color, checkbox, radio, and button-like types are intentionally
  excluded; this needs to remain prominent so consumers do not interpret it as
  a generic wrapper for every input type.

### Missing or useful demos

- Input type gallery.
- Prefix/suffix composition guidance, if supported through surrounding markup.
- Datalist/autocomplete.

### Actions

1. Add a compact supported-type render/browser matrix.
2. Add a datalist example if it is considered supported.
3. Keep specialized input types out of this primitive unless separately
   designed.

## Popover

### Current strengths

- Covers focus management without trapping Tab, Escape/outside dismissal,
  dismissal cancellation, persistent mode, detached and composed triggers,
  programmatic control, Floating UI, trigger metrics, final focus, autofocus,
  forms, accessible relationships, and axe.
- Public demos cover nearly the full author-facing API.

### Potential issues and untested behaviour

- Unit tests do not explicitly cover disconnect/reconnect, open Content
  removal, or Root movement as deeply as Dialog does.
- CSS Anchor positioning is exercised indirectly, but resolved placement and
  fallback flipping are not asserted near viewport edges.
- Floating positioning is tested, but resize/scroll repositioning and cleanup
  after rapid close are primarily implementation-level concerns.
- No narrow viewport or oversized-content browser test exists.
- Reduced-motion lifecycle is not covered.
- Nested Popovers are not demonstrated or tested as a supported/unsupported
  composition.

### Missing or useful demos

- Nested Popover policy/example.
- Edge-of-viewport flipping.
- Oversized scrollable content.

### Actions

1. Port relevant removal/movement/reconnection tests from Dialog.
2. Add edge placement and narrow viewport browser tests for CSS Anchor and
   Floating modes.
3. Explicitly document whether nested Popovers are supported.

## Radio

### Current strengths

- Strong native-first implementation.
- Covers keyboard selection, one tab stop, indicators, form submission,
  programmatic events, reset, required validity, Field integration, disabled
  groups, dynamic names and labels, no-JS behaviour, responsive reflow, and
  axe.
- SSR already provides a fully functional native group.

### Potential issues and untested behaviour

- Dynamic insertion/removal/moving between groups is not as explicit as live
  name changes.
- No public form-reset demo exists.
- Custom indicator behaviour in forced-colours mode is not checked.
- Horizontal radio-group orientation is not a first-class API; consumers may
  visually arrange radios horizontally while native arrow behaviour remains
  platform-defined. This is acceptable but should be clear.
- Browser coverage focuses on one value shape and label pattern.

### Missing or useful demos

- Form reset.
- Horizontal presentation.
- A group whose labels contain descriptions.

### Actions

1. Add live member insertion/removal/move tests.
2. Add a reset demo.
3. Add forced-colours coverage for the custom indicator.

## Select

### Current strengths

- Recently completed beta pass.
- Covers custom and native modes, native no-JS fallback, forms, required
  validation, clear, groups, disabled options, typeahead, selected-item
  dismissal, Escape, Tab, outside dismissal, popup width, ItemIndicator,
  dynamic insertion, public properties/events, reset, SSR text extraction,
  cleanup, axe, Chromium, and Firefox.
- Public demos are now consistent and representative.

### Potential issues and untested behaviour

- The optional Floating UI positioning entry point has no dedicated public demo
  or browser test, unlike Popover and Tooltip.
- Dynamic insertion is covered, but removal, reordering, group movement, and
  mutation of `value`, `disabled`, and `textValue` need explicit tests.
- Form reset is unit-tested but not browser-tested.
- There is no narrow viewport test for long values or an open listbox.
- Typeahead does not have coverage for repeated-character cycling, timeout
  reset in a real browser, diacritics, or locale-sensitive casing.
- Home/End are unit behaviour but not directly asserted in the browser suite.
- Programmatic `disabled`, `show`, `hide`, and `toggle` are unit-only.
- WebKit could not be run on the local audit host because its Playwright system
  dependencies are unavailable; CI is responsible for that engine.
- Rich item content is intentionally non-interactive. There is no diagnostic
  warning when an author places a link or button inside an item.

### Missing or useful demos

- Floating UI positioning.
- Long values and constrained width.
- Programmatic control/events.
- Dynamic options, if that is intended as a promoted use case.

### Actions

1. Add a Floating UI demo and browser test.
2. Add live removal/reorder/attribute-mutation tests.
3. Add browser form-reset and narrow-layout tests.
4. Decide whether interactive descendants should produce a development
   diagnostic.
5. Add repeated-character and timeout typeahead tests if native-like cycling is
   desired.

## Tabs

### Current strengths

- Covers SSR selection, disabled defaults, click and cancellable value changes,
  controlled assignment, manual/automatic activation, horizontal/vertical
  arrows, Home/End, focus looping, disabled root/tabs, no-JS panels, and axe.
- Public demos cover the main API configurations.

### Potential issues and untested behaviour

- No dynamic insertion, removal, reordering, or value mutation tests exist.
- No disconnect/reconnect test proves listener cleanup and state restoration.
- No nested Tabs scoping test exists at runtime, despite SSR context nesting
  being tested.
- Horizontal keyboard behaviour is not tested in RTL. Depending on the desired
  convention, Left/Right may need to follow visual direction.
- No test covers a selected tab becoming disabled or being removed.
- No test covers all tabs disabled.
- No narrow viewport/overflow strategy exists for a long tab list.
- No tab panel lazy-mounting or manual persistence guidance is provided. This
  may be intentionally out of scope, but consumers will ask.

### Missing or useful demos

- Overflowing/scrollable tab list.
- Nested Tabs.
- Dynamic tabs only if supported.

### Actions

1. Add selected-tab removal/disable and all-disabled tests.
2. Add nested runtime and reconnect tests.
3. Decide and test RTL arrow semantics.
4. Add an overflow guidance demo.

## Tooltip

### Current strengths

- Covers focus, hover delay, pointer transfer to content, Escape, activation
  suppression, grace periods, toolbar transitions, single-open coordination,
  disabled state, detached triggers, Floating UI, diagnostics for interactive
  content, public properties, and axe.
- Public demos cover delay, toolbar, disabled, placement, Floating UI,
  detached, and programmatic use.

### Potential issues and untested behaviour

- No explicit disconnect/reconnect or trigger/content removal test exists.
- Touch and coarse-pointer behaviour is not documented or tested.
- CSS Anchor edge flipping and viewport collision are not asserted.
- Delay timers and page-level grace state need cleanup tests when a Tooltip is
  removed before opening.
- No no-JS browser assertion documents the server-rendered relationship and
  hidden content state. A custom tooltip cannot remain interactive without
  JavaScript, but it should degrade without exposing stale descriptions.
- No narrow viewport, zoom, or forced-colours check exists.
- Tooltip content is correctly restricted to non-interactive content, but rich
  text naming/announcement is not manually verified.

### Missing or useful demos

- Long wrapping tooltip.
- Coarse-pointer/touch guidance.
- Tooltip inside an overflow-clipped container.

### Actions

1. Add timer, removal, reconnect, and detached-trigger retargeting tests.
2. Add a JavaScript-disabled semantic assertion.
3. Add long-content and viewport-edge browser tests.
4. Document touch expectations explicitly.

## Recommended work sequence

### Phase 1 — shared confidence infrastructure

1. Make cross-browser pull-request gating explicit.
2. Add shared narrow viewport and horizontal overflow helpers.
3. Define a reusable lifecycle checklist/test helper.
4. Add a short manual assistive-technology release checklist.

### Phase 2 — lifecycle and mutation hardening

1. Avatar teardown and rapid source mutation.
2. Tabs dynamic selection, nested scope, and reconnect.
3. Tooltip timer/removal/reconnect.
4. Popover removal/movement/reconnect.
5. Select removal/reorder/attribute mutation.
6. Checkbox and Radio live member movement.

### Phase 3 — missing browser evidence

1. Select Floating UI and form reset.
2. Field no-JS and stale async validation.
3. Popover and Tooltip edge placement.
4. Forced-colours checks for custom form indicators.
5. Narrow viewport smoke tests across all fixtures.

### Phase 4 — public demo gaps

Prioritize demos that teach meaningful contracts:

1. Field async validation.
2. Dialog native form.
3. Select Floating UI.
4. Avatar live source replacement.
5. Tabs overflow.
6. Checkbox/Radio reset.

### Phase 5 — optional feature decisions

Record explicit decisions before implementing:

- nested Checkbox parent trees;
- dynamic Tabs as a promoted use case;
- RTL tab navigation convention;
- nested Popovers;
- Select repeated-character typeahead cycling;
- Tooltip touch/coarse-pointer behaviour;
- Breadcrumb composition diagnostics;
- datalist support in Input.

## Exit criteria

The beta-hardening audit can be considered closed when:

- all engine-specific browser jobs are required before merge or have a
  documented exception;
- every runtime-owning beta primitive has relevant disconnect/reconnect tests;
- every fixture passes a shared narrow viewport smoke test;
- each P1 item is either implemented or explicitly moved to post-beta scope;
- the priority public demos above exist or have a recorded decision not to add
  them;
- the full repository validation and all browser projects pass in CI;
- manual NVDA/Firefox and VoiceOver/Safari checks are recorded for Dialog,
  Alert Dialog, Field validation, Select, Tabs, and Tooltip.

## Final recommendation

Do not demote any current beta primitive. The collection is coherent and
substantially tested. Complete Phases 1–3 as a bounded hardening pass, add the
highest-value demos from Phase 4, then proceed to the remaining primitives.
Treat Phase 5 as product design work rather than audit cleanup.
