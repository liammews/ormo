# Codebase audit

Audit date: 2026-07-29. Current working tree, including uncommitted work.

Scope: all 15 primitive families, component anatomy, runtime and behaviour CSS,
documentation demos/pages, unit/SSR/browser tests, package exports and CI.

## Summary

Good foundation. Components follow a recognisable Astro-native model, accessibility
is treated as behaviour, JS is usually conditional, public state is visible in the
DOM, and tests are unusually strong for an early component library.

Main weakness: one primitive spans many manually synchronised files:

`component parts → types/exports → runtime/CSS → demos → MDX → browser fixture → tests → sidebar/status → changeset`

Drift is already visible. Priority should be tightening this contract and fixing a
few concrete runtime/CSS defects, not adding more tooling or abstraction.

## Current verification

- `pnpm test`: **316 passed** — 273 happy-dom + 43 Astro render tests.
- Library `astro check`: 0 errors; deprecated `orientation` hint in
  [Accordion.Root](../src/components/accordion/Root.astro#L16).
- Docs lint, Astro check and build pass separately; docs check has a deprecated
  `document.execCommand` hint in
  [CopyButton](../ormo.docs/src/components/docs/CopyButton/CopyButton.astro#L43).
- `pnpm validate`: currently stops at docs formatting. Three current files fail
  Prettier: `CodeBlock.astro`, `ThemeSwitcher.astro`, `tokens/colors.css`.
- Chromium Playwright: **115 passed, 13 failed**. Accordion (5), Breadcrumbs (3)
  and Checkbox (5) expectations still use old demo labels/copy. Mostly test/demo
  drift, not evidence that the primitive behaviours regressed.
- Firefox/WebKit not run in this audit. CI currently runs Chromium only.

## Primitive matrix

| Primitive    | Implementation shape                   | Demo/test state                                | Audit note                                          |
| ------------ | -------------------------------------- | ---------------------------------------------- | --------------------------------------------------- |
| Accordion    | Multipart custom element               | 6 demos; DOM + context + browser/no-JS         | No Astro render suite; current browser copy drift   |
| Alert Dialog | Multipart native dialog + runtime      | 4 demos; DOM + Astro + browser/axe             | Strong broad interaction coverage                   |
| Avatar       | Multipart image runtime                | 7 demos; DOM + Astro + context + browser       | Browser fixture includes only 2 demos               |
| Breadcrumbs  | Static native SSR                      | 4 demos; Astro + context + browser/no-JS       | Good zero-JS contract; current copy drift           |
| Button       | Native/non-native, conditional runtime | 6 demos; DOM + Astro + browser/no-JS           | Fixture omits default/disabled demos                |
| Checkbox     | Native input, optional/group runtime   | 7 demos; DOM + Astro + context + browser/no-JS | Current label drift; shared event typing gap        |
| Dialog       | Native dialog + runtime                | 3 demos; DOM + Astro + browser/axe             | Strong; some fixed-time waits                       |
| Field        | Multipart validation runtime           | 3 demos; DOM + Astro + browser/axe             | SSR context has no direct isolation test            |
| Fieldset     | Static native SSR                      | 3 demos; Astro + diagnostics + browser/no-JS   | Good native-first reference                         |
| Input        | Static native input                    | 3 demos; Astro + diagnostics + browser/no-JS   | Public MDX page only shows opening demo             |
| Popover      | Runtime + optional Floating UI         | 8 demos; DOM + context + browser               | No Astro/no-JS suite; weak axe gate; MDX incomplete |
| Radio        | Native input + optional group runtime  | 4 demos; DOM + Astro + context + browser/no-JS | Shared event typing gap; stale CSS reference        |
| Select       | Native/enhanced + optional Floating UI | 3 demos; DOM + Astro + browser                 | Missing CSS sides; context/helper gaps              |
| Tabs         | Multipart custom element               | 5 demos; DOM + context + browser/no-JS         | No Astro render suite; MDX incomplete               |
| Tooltip      | Runtime + optional Floating UI         | 8 demos; DOM + browser                         | No Astro/no-JS suite; weak axe gate; MDX incomplete |

## Confirmed issues / bugs

### P0 — current quality gates red

- Browser tests are coupled to mutable instructional copy. Current demo edits
  changed labels/content while tests still expect e.g. old Accordion shipping
  labels and Breadcrumbs “Award Winners”. See
  [Accordion browser assertions](../tests/browser/accordion.spec.ts#L8),
  [Breadcrumbs assertions](../tests/browser/breadcrumbs.spec.ts#L8) and
  [Checkbox assertions](../tests/browser/checkbox.spec.ts#L45).
- Root validation currently fails on three formatting errors. Likely
  work-in-progress, but still means the documented definition of done is not met.

Keep browser fixtures reusing real demos — that catches useful drift. Split the
contract: stable fixture/demo IDs for behavioural tests; a small explicit set of
accessible-name/content assertions for semantics. Copy edits should not break
unrelated state tests.

### P1 — Select exposes sides its default CSS does not implement

`SelectSide` allows `top | right | bottom | left`
([types](../src/components/select/types.ts#L3)) and Content serialises all values
([Content](../src/components/select/Content.astro#L6)), but CSS-anchor rules only
cover top/bottom ([select.css](../src/runtime/select.css#L34)). Right/left only
work through optional Floating UI. Default mode silently fails part of its public
contract. No side/align matrix test catches this.

### P1 — detached Popover/Tooltip triggers lose authored inline CSS

Both runtimes overwrite trigger `anchor-name`, omit it from their snapshots, then
unconditionally remove it:

- [Popover snapshot](../src/runtime/popover.ts#L58) and
  [release](../src/runtime/popover.ts#L665)
- [Tooltip snapshot](../src/runtime/tooltip.ts#L106) and
  [release](../src/runtime/tooltip.ts#L878)

This violates the repository rule to preserve/restore authored attributes.

### P1 — accessibility gates differ by primitive

Most suites fail on any axe violation. Popover and Tooltip filter to `critical`,
so serious/moderate/minor failures pass:

- [Popover](../tests/browser/popover.spec.ts#L175)
- [Tooltip](../tests/browser/tooltip.spec.ts#L99)
- Compare [Select](../tests/browser/select.spec.ts#L100)

They also scan a fixture with overlay content closed. Test each meaningful open
state and use one shared axe policy/helper.

### P1 — four component pages are placeholders despite finished demos/APIs

[Input](../ormo.docs/src/pages/docs/components/input.mdx),
[Popover](../ormo.docs/src/pages/docs/components/popover.mdx),
[Tabs](../ormo.docs/src/pages/docs/components/tabs.mdx) and
[Tooltip](../ormo.docs/src/pages/docs/components/tooltip.mdx) contain only the
opening `DemoBlock`. This conflicts with the documented required anatomy, API,
accessibility, styling and runtime sections
([guide](creating-a-new-component.md#L266)). Existing focused demos are not exposed
on those pages: 20 demos total (Input 2, Popover 7, Tabs 4, Tooltip 7).

### P1 — demo CSS has contract/accessibility defects

- Accordion Disabled displays its variant CSS in MDX
  ([page](../ormo.docs/src/pages/docs/components/accordion.mdx#L90)) but the live
  demo imports only shared CSS
  ([demo](../ormo.docs/src/components/demos/Accordion/AccordionDisabled/AccordionDisabledDemo.astro#L1)).
  The displayed stylesheet is not applied, violating the source-tab rule.
- Checkbox/Radio use undefined `--content-danger` with a fixed red fallback;
  Select uses undefined `--critical-content` falling back to `currentColor`.
  Defined token is `--content-error`
  ([theme](../ormo.docs/src/styles/tokens/theme.css#L10)). This risks poor/error
  state contrast, especially across themes.
- Tooltip animates opacity/transform but has no reduced-motion override
  ([tooltip CSS](../ormo.docs/src/components/demos/Tooltip/index.css#L17)), unlike
  the documented demo requirement.

### P1 — shared event typing lives in one unrelated subpath

The global `ormo:value-change` event map is declared only in Accordion types
([types](../src/components/accordion/types.ts#L54)), while Tabs, CheckboxGroup and
RadioGroup emit the same event with component-specific detail. Subpath-only
consumers may see generic `Event`; tests need casts. Shared global event types
should live in a neutral internal/public type module.

### P2 — Select SSR text conversion is incomplete

`htmlToText` manually decodes a small named-entity set
([select SSR context](../src/internal/select-ssr-context.ts#L59)). Numeric, hex and
many named entities can leak into fallback labels/`data-text-value`. Add
entity-rich tests before changing implementation.

### P2 — small stale/dead CSS details

- Checkbox and Radio behaviour CSS cite GD-015 (Tooltip), not GD-016/GD-021:
  [checkbox.css](../src/runtime/checkbox.css#L1),
  [radio.css](../src/runtime/radio.css#L1).
- Select says consumer classes win because of `:where()`, while its enhancement
  rules deliberately use `!important`
  ([select.css](../src/runtime/select.css#L1)). Document the exception.
- Empty, unreferenced `ormo.docs/src/components/demos/Accordion/Example.css`.
- Empty `--surface-overlay` token
  ([theme.css](../ormo.docs/src/styles/tokens/theme.css#L23)).

## Inconsistencies / drift risks

### Component/runtime

- Core anatomy is consistent: `.astro` parts + `types.ts` + `index.ts`. Runtime
  loading is not documented: normal roots use inline `<script>` imports, while
  Button/Checkbox/Radio use `Runtime.astro` for conditional/reused loading.
- Prop typing/destructuring and boolean serialisation vary. Mostly harmless, but
  extra ambiguity for agents.
- Public state hooks, internal `data-ormo-*` selectors, serialised config and
  runtime snapshots are not clearly separated. Some internal config uses generic
  attributes such as `data-name`/`data-default-value`.
- Diagnostics live in several models: SSR `console.warn`, runtime warnings,
  monolithic dev-toolbar scans, and newer dedicated scan modules. No stated rule
  for ownership, message IDs or test location.
- `styleToCssText` is duplicated in Select, Popover and Tooltip Content. Dialog /
  Alert Dialog and Popover / Tooltip runtimes also repeat substantial low-level
  lifecycle scaffolding.

### Demos/docs/CSS

- Accordion/Breadcrumbs nest each demo in a folder; most families keep demos flat,
  despite the guide saying Accordion is the reference
  ([guide](creating-a-new-component.md#L168)).
- Variant styles vary between nested `index.css`, `disabled.css`, `pending.css`,
  `controlled.css`, etc. A reader cannot predict location/name.
- Browser fixtures include only subsets of public demos: Avatar 2/7, Accordion
  5/6, Popover 5/8, Tooltip 4/8; Button omits default/disabled. Thus “real demo”
  browser/axe coverage can silently drift.
- Browser fixture CSS applies test-only visual overrides
  ([browser-fixtures.css](../ormo.docs/src/styles/browser-fixtures.css#L25)).
  This reduces fidelity between public docs styling and axe results.
- Sidebar page/status data is hand-maintained in
  [layout.astro](../ormo.docs/src/layouts/layout.astro#L25), another sync point.

### Tests/tooling/CI

- The guide calls `pnpm validate` the complete suite
  ([guide](creating-a-new-component.md#L162)); it excludes Playwright
  ([package scripts](../package.json#L109)). CI runs browser tests separately
  ([workflow](../.github/workflows/ci.yml#L22)).
- Real taxonomy is undocumented: runtime `.test.ts`, render `.astro.test.ts`,
  `*-ssr-context`, diagnostics, browser spec and browser fixture.
- `test:watch` excludes every `.astro.test.ts`
  ([Vitest config](../vitest.config.ts#L6)). Both test runs use
  `--passWithNoTests`, allowing a broken include pattern to pass.
- Astro render suites are absent for Accordion, Popover, Tabs and Tooltip. Direct
  SSR-context isolation tests are absent for Field and Select.
- CI defines three Playwright projects but installs/runs Chromium only
  ([config](../playwright.config.ts#L18),
  [workflow](../.github/workflows/ci.yml#L23)). Native dialog/popover/focus/CSS
  anchor behaviour deserves periodic Firefox/WebKit coverage.
- Docs build twice in CI: once in docs validation, again before Playwright.
- Traces are recorded on retry but CI does not upload `test-results`.
- A few browser tests use fixed waits, e.g.
  [Dialog](../tests/browser/dialog.spec.ts#L158) and
  [Alert Dialog](../tests/browser/alert-dialog.spec.ts#L294).

## Improvements, prioritised

### 1. Define one primitive contract

Add a compact machine-readable manifest or checked Markdown matrix per primitive:

- public parts/types/subpaths/root export
- static, conditional-native or custom-element runtime model
- runtime entry and loading condition
- SSR context
- public styling hooks/custom properties
- private selectors/config
- DOM properties/methods/events
- behaviour CSS and justification
- demos + MDX + nav status
- runtime/render/context/browser/no-JS/axe coverage
- changeset

Use it in review. Ideally derive nav/status and a consistency check from it.

### 2. Scaffold the boring surfaces

A small repository script can create component/type/index files, demo folder/CSS,
MDX from the existing template, fixture, test stubs and checklist entries. Prompt
for package/root exports and changeset. No library needed. Do not generate runtime
behaviour.

### 3. Make validation names truthful

- `validate`: fast format/lint/type/unit/render/docs build.
- `validate:full` or `ci`: above + browser.
- Separate `test:watch:runtime` and `test:watch:astro`.
- Remove `--passWithNoTests` where a suite is mandatory.
- Avoid the second docs build in CI.

### 4. Standardise test helpers/policy

- One axe helper: same tags, zero violations, explicit closed/open states.
- One Astro render helper instead of duplicated opening-tag regexes.
- Side × align × direction matrix for Popover/Tooltip/Select CSS anchors and
  Floating UI.
- Snapshot/restore tests for every runtime-authored attribute/style.
- Define whether every demo must appear in a browser fixture; encode exceptions.
- Prefer observable state/events over fixed sleeps.

### 5. Extract only stable duplication

Good candidates after characterisation tests:

- `styleToCssText`
- overlay trigger association + attribute/style snapshot restoration
- document-scoped registry/reconnection
- transition lifecycle

Avoid one mega overlay controller or CSS generation system. Similar components
still have different semantics.

### 6. Clarify internal docs for humans + agents

Document:

- three runtime categories and when `Runtime.astro` is appropriate
- exact test file taxonomy and ownership
- hook taxonomy: public state vs serialised config vs private selector/snapshot
- behaviour-CSS acceptance criteria and required decision reference
- demo folder/naming/CSS rule
- event naming, cancellation and global typing ownership
- supported document boundary: main document only vs iframe/adopted nodes
- minimum manual browser/screen-reader checks before beta

## Things to continue

- Strong guiding principles + dated design decisions. They explain _why_, not just
  current code. Keep superseded decisions instead of rewriting history.
- Predictable public anatomy and independent package subpaths for all 15 families.
- All 74 demos import their live component CSS; all 15 opening demos show the
  actual Astro source + shared `index.css` through `?raw`, avoiding copied snippets.
- Native-first progressive enhancement: static Breadcrumbs/Fieldset/Input, native
  Checkbox/Radio, usable Select fallback, conditional Button runtime.
- No component-local visual styles. Only five scoped behaviour/accessibility CSS
  files; namespaced custom properties; generally low-specificity `:where()`.
- Consumer classes + public DOM state; private behaviour hooks consistently start
  `data-ormo-<family>-<part>`.
- Guarded custom-element registration, cleanup/reconnection, Astro navigation
  handling, ARIA/state synchronisation.
- Layered tests: fast DOM logic, Astro SSR markup, real browser interaction, axe
  and deliberate no-JS coverage.
- Browser tests favour roles/names and public behaviour: focus, forms, keyboard,
  cancellation, reconnection, detached triggers, reset and native fallback.
- Colocated docs consume `workspace:*`; implementation, demos and docs can change
  atomically.
- Changesets and frozen-lockfile CI.

## Libraries / cost

No new library required for priority work.

Optional later:

| Option                                      | Why                                                | Cost/trade-off                                                                  |
| ------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------- |
| Packed-tarball consumer smoke test          | Verify published files and Astro subpath imports   | Built-in; small CI time                                                         |
| `publint`                                   | Catch package metadata/export/files mistakes       | Free OSS dev dependency; seconds of CI                                          |
| `@arethetypeswrong/cli`                     | Test consumer TypeScript resolution across exports | Free OSS dev dependency; seconds of CI; some config for source `.astro` package |
| `@vitest/coverage-v8`                       | Find unvisited runtime branches                    | Free OSS; extra CI time; percentages can reward shallow tests                   |
| Firefox + WebKit Playwright on main/nightly | Cross-browser native/CSS behaviour                 | No new library; about two additional browser workloads + artifact storage       |

Do not add Stylelint, CSS-in-JS, a generator framework or a new component-test
runner yet. Existing Prettier, ESLint, Vitest, Playwright and axe are sufficient;
missing contracts/tests are the problem.
