# AGENTS.md

Guidance for coding agents working in this repository.

## Project overview

Ormo is an accessible, unstyled UI primitive library for Astro. It is an ESM
pnpm workspace with the library at the repository root and the documentation
site in `ormo.docs/`.

The public API is intentionally unstable, but changes should still preserve
accessibility, SSR output, browser behaviour, and package exports unless the
task explicitly changes their contract.

## Tone of voice

Use ASD-STE100 Simplified Technical English + British English.

Sacrifice grammar and completeness to be more concise.

## Repository map

- `src/components/<primitive>/`: Astro parts, public types, and barrel exports.
- `src/runtime/`: client-side custom elements and shared behaviour CSS.
- `src/internal/`: private SSR context and implementation helpers. Do not export
  these accidentally.
- `src/index.ts`: root package exports.
- `src/events.ts`: shared public event types/utilities.
- `src/dev-toolbar/`: development-only accessibility diagnostics.
- `tests/unit/*.test.ts`: runtime tests using Vitest and happy-dom.
- `tests/unit/*.astro.test.ts`: server-rendered markup tests.
- `tests/fixtures/`: Astro fixtures used by render and browser tests.
- `tests/browser/`: Playwright interaction and accessibility tests.
- `ormo.docs/`: documentation site, primitive examples, and browser-test pages.
- `primitive-contracts.json`: source of truth for each primitive's required
  files and delivery surface.
- `PRIMITIVE_CONTRACT.md`: explanation of the primitive contract system.
- `scripts/`: contract validation and primitive scaffolding.

## Toolchain and commands

Use Node.js 22.12 or newer and pnpm 11. Run commands from the repository root
unless noted otherwise.

```sh
pnpm install
pnpm check:contracts       # validate primitive manifests and required files
pnpm format:check          # check formatting without modifying files
pnpm lint
pnpm check                 # Astro and TypeScript checks
pnpm test:runtime          # happy-dom runtime tests
pnpm test:coverage         # runtime tests and critical shared-code thresholds
pnpm test:astro            # server-rendered Astro tests
pnpm test                  # both unit suites
pnpm validate:library      # all library checks
pnpm validate:docs         # docs checks and build
pnpm validate              # library and docs validation
pnpm test:browser:chromium # docs build plus Chromium Playwright tests
pnpm validate:full         # validate plus Chromium browser tests
```

During iteration, run the narrowest relevant Vitest target, for example:

```sh
pnpm vitest run tests/unit/tabs.test.ts
pnpm vitest run --config vitest.astro.config.ts tests/unit/tabs.astro.test.ts
```

Run `pnpm format` only when broad formatting changes are intended; it formats
the whole workspace. Prefer formatting or editing only touched files otherwise.

## Working rules

- Inspect `git status` before editing. Preserve unrelated user changes and do
  not rewrite, revert, or format files outside the task's scope.
- Follow nearby primitives as the primary implementation pattern. Similar
  structure does not imply identical ARIA semantics; verify the specific
  widget behaviour being changed.
- Keep server markup and client runtime in sync. Initial state should render
  correctly without JavaScript and survive runtime hydration/connection.
- Preserve authored attributes and state when runtime code temporarily manages
  them. Test reconnection, dynamic children, disabled state, and nested roots
  when relevant.
- Scope DOM queries and event handling to the owning primitive root so nested
  primitives do not interfere with one another.
- Development diagnostics must be guarded by `import.meta.env.DEV` and should
  identify both the problem and the relevant element.
- Keep the library unstyled. CSS in `src/runtime/` should provide behaviour
  required for the primitive (for example hidden/inert state), not visual
  design.
- Maintain strict TypeScript types. Avoid `any`, unsafe casts, and public API
  widening when a precise type is available.
- Use existing `ormo:*` custom-event conventions. Preserve cancellation and
  controlled/uncontrolled behaviour where the primitive supports them.
- Do not hand-edit generated output such as `.astro/`, `dist/`,
  `playwright-report/`, or `test-results/`.

## Adding or changing a primitive

Read `PRIMITIVE_CONTRACT.md` and inspect the primitive's entry in
`primitive-contracts.json` before changing its structure.

For a new primitive, prefer:

```sh
pnpm scaffold:primitive <id>
```

The scaffold is only a starting point; implement and review its runtime,
semantics, documentation, and tests. A complete public primitive generally
requires all of the following:

- component parts, types, and local `index.ts` exports;
- the appropriate root and package subpath exports;
- runtime logic and behaviour CSS where required;
- SSR context when parts coordinate during server rendering;
- runtime, Astro render, and SSR-context tests as applicable;
- a fixture and Playwright browser specification;
- a documentation page/demo;
- an accurate `primitive-contracts.json` entry; and
- a changeset for a user-visible package change.

Do not change a primitive's manifest `status` casually. Status is a product and
public-API decision.

## Testing expectations

Match validation effort to the change, then expand before handoff:

- Component markup or SSR changes: run the relevant `*.astro.test.ts` and SSR
  context tests.
- Runtime behaviour changes: run the relevant runtime unit test.
- Keyboard, focus, dismissal, positioning, or accessibility changes: also run
  the relevant Playwright spec when feasible.
- Contract, exports, or primitive file changes: run `pnpm check:contracts`.
- Documentation changes: run `pnpm validate:docs`.
- Cross-cutting or release-ready changes: run `pnpm validate`; use
  `pnpm validate:full` when browser coverage is warranted.

Add regression coverage for bug fixes. Tests should assert observable markup,
ARIA state, keyboard/focus behaviour, emitted events, and state restoration—not
private implementation details.

## Documentation and changesets

Read `component-documentation-template.mdx` before writing any documentation.

Keep documentation examples aligned with the real public API and accessible by
default. The docs navigation order is editorial and is not controlled by the
primitive manifest.

Add a changeset under `.changeset/` for user-visible library changes unless the
task is docs-only, test-only, or explicitly excludes release notes. Choose the
smallest accurate semver impact; this package is pre-1.0, so confirm ambiguous
release impact rather than guessing.

## Handoff

Summarize what changed, list the checks actually run and their results, and
call out any checks not run or decisions that still need maintainer review.
