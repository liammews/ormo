# Ormo

Accessible, unstyled UI components for Astro.

Ormo is in early development. The API is unstable, breaking changes are
expected, and the package is not yet recommended for production use.

Ormo provides composable Astro components with accessible semantics and
browser behaviour built in, while leaving styling to you.

## Project status

Ormo is open source under the [MIT License](./LICENSE), so you are welcome to
inspect, use, and fork the code.

The project is currently being developed privately in public. We are not
accepting pull requests or other contributions during this early stage. This
gives the initial direction and API room to evolve quickly. Contribution
guidelines will be updated when the project is ready for wider collaboration.

## Development

Ormo requires Node.js 22.12 or newer and pnpm 11.

```sh
pnpm install
pnpm validate
```

Run the documentation site locally with:

```sh
pnpm docs:dev
```

## Browser support

Ormo supports the current stable desktop releases of Chrome, Firefox and
Safari. CI tests each browser through the corresponding Playwright engine on
every main-branch and scheduled build. Pull requests run the Chromium suite.

Ormo does not currently certify mobile browsers or older browser releases.
Some popup primitives require the HTML Popover API. CSS Anchor Positioning is
the default positioning path; use the documented optional Floating UI entry
when broader positioning support is required.

## License

Ormo is released under the [MIT License](./LICENSE).
