---
"@ormo/primitives": patch
---

Fix Slider arrow keys in RTL in Safari. WebKit does not mirror Left and Right
Arrow for an RTL range input, so the thumb moved against the arrow. The runtime
now handles these two keys for horizontal RTL Thumbs, so Left Arrow increases
and Right Arrow decreases the value in every browser. Other keys, LTR sliders,
and vertical sliders keep native behaviour.
