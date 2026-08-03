# Combobox beta-readiness audit

Date: 31 July 2026

## Recommendation

Combobox has completed its P0 pass and is ready for `beta`. Its composition,
constrained-selection model, accessibility semantics, progressive enhancement,
form integration, documentation structure, and public demos are coherent. No
API redesign or feature expansion is needed. The P1 items can follow during
normal beta hardening.

## Evidence reviewed

- Public Astro parts, types, package exports, and primitive contract
- SSR context and native form fallback
- Combobox runtime, behaviour CSS, and Floating UI adapter
- Documentation, public demos, and browser fixture
- Runtime, Astro render, browser interaction, no-JavaScript, and axe tests
- Full repository validation and the current cross-browser CI policy

Current baseline:

- `pnpm validate` passes
- 300 runtime tests pass
- 51 Astro render tests pass
- The documentation check and production build pass
- The focused Combobox browser suite passes in Chromium and Firefox
- WebKit could not be run locally because its host libraries are unavailable;
  repository CI runs all engines on `main` and scheduled builds

## P0 — complete before beta

### 1. Make cancelled Clear operations atomic

`ormo:combobox-before-value-change` can cancel a Clear value change, but the
Clear click handler currently clears `inputValue` even when the committed
value change was prevented. This leaves the machine value and visible text out
of sync.

Action:

- Only clear the input, filter state, and related presentation when
  `#setValue("", "clear", true)` succeeds.
- Add a focused unit test that cancels Clear and asserts that `value`,
  `inputValue`, selected state, and Clear visibility are unchanged.

### 2. Satisfy the custom-element lifecycle contract

Combobox aborts listeners, disconnects its observer, and stops its positioner,
but it has no teardown/reconnection tests and does not restore runtime-authored
attributes and styles in the way Select does. This is a contract gap for a
primitive classified as `custom-element`.

Action:

- Define which authored state is restored on disconnect.
- Test removal and reconnection without duplicate events or observers.
- Test disconnect while open and while Floating UI positioning is active.
- Normalize transient open/highlight/ARIA state during teardown.

### 3. Test the advertised positioning branches

The default CSS Anchor path works in the demos, but Combobox has no focused
assertion for popup width/placement and no test of its public `floating` entry.

Action:

- Add a browser assertion that the popup opens at the composed control width
  both before and after a selection reveals Clear.
- Add a unit test for positioner registration, arguments, and cleanup.
- Add one browser fixture or focused test for `positioning="floating"`.

### 4. Correct stale and mismatched documentation

The Runtime section says the native select is visible before enhancement and
still refers to a native mode. The current implementation hides the fallback
in normal JavaScript rendering and reveals it through `<noscript>`. The anatomy
example also places Clear after Toggle, unlike the finalized composition.

Action:

- Describe the actual JavaScript and no-JavaScript paths.
- Remove the obsolete native-mode sentence.
- Put Clear before Toggle in the anatomy example.
- Document that Clear is shown only for a committed selection.

## P1 — beta hardening

### Diagnostics

Add development warnings for icon-only Toggle and Clear parts without an
accessible name. Select already diagnoses unnamed Clear controls.

### Browser form reset

Form reset is unit-tested. Add a browser assertion covering the input label,
committed value, selected indicator, Clear visibility, and validity state.

### Dynamic composition

Insertion is unit-tested. Add removal, reordering, group-label mutation, and
removal of the currently selected item. Confirm the fallback options and
visible input remain coherent.

### Input and event contract

Document event detail shapes and reason values explicitly. Add focused tests
for programmatic `inputValue`, native-control synchronization, and the ordering
of custom value, input-value, native `input`, and native `change` events.

### Responsive and international layouts

Add a 320 CSS-pixel overflow assertion, a long-item-label case, and an RTL
positioning/navigation smoke test.

### Manual assistive-technology pass

Before the first beta release, manually check NVDA/Firefox and
VoiceOver/Safari for expanded state, active-option announcements, empty
results, selection, clearing, and required invalid state. Axe cannot verify
announcement quality.

## Explicitly deferred beyond beta

These are separate product capabilities rather than omissions from the current
single-value constrained Combobox:

- Multi-select
- Freeform/custom values
- Async loading and remote data ownership
- Virtualized item collections
- Creatable options

## Beta exit checklist

- [x] Cancelled Clear leaves all state unchanged
- [x] Disconnect/reconnect and open teardown are tested
- [x] CSS Anchor sizing and Floating UI cleanup are tested
- [x] Runtime and anatomy documentation match the implementation
- [x] Full validation passes
- [ ] Combobox browser tests pass in Chromium, Firefox, and WebKit CI
- [x] `primitive-contracts.json` status changes from `dev` to `beta`
- [x] Changeset describes the beta addition
