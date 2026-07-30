# Manual browser accessibility checks

Run these checks before accepting changes to an interactive primitive. Record the
browser, operating system, input method and result in the pull request.

- Keyboard: reach every control in a logical order; operate every documented
  key; confirm focus remains visible and returns to the invoking control.
- Overlays: open and close with keyboard and pointer; confirm modal focus
  containment where required and normal page navigation for non-modal popovers.
- Reduced motion: enable the operating-system preference and confirm state
  changes remain understandable without transition-dependent timing.
- Forced colours/high contrast: confirm controls, focus indicators, disabled
  states, errors and overlay boundaries remain distinguishable.
- Zoom and reflow: test at 200% zoom and at 320 CSS pixels without clipped
  controls, two-dimensional page scrolling or obscured focused content.
- Screen reader smoke test: confirm names, roles, states, relationships and
  dynamic announcements for the changed primitive.

Automated axe checks are required in both closed and meaningful open states, but
do not replace this manual record.
