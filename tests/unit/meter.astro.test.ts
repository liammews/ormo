import { experimental_AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";

import Meter from "../../src/components/meter/Meter.astro";
import type { MeterProps } from "../../src/components/meter/types";
import { findOpeningTag } from "./helpers/astro";

describe("Meter markup", () => {
  let container: Awaited<ReturnType<typeof experimental_AstroContainer.create>>;

  beforeAll(async () => {
    container = await experimental_AstroContainer.create();
  });

  it("renders native bounded-scalar semantics", async () => {
    const html = await container.renderToString(Meter, {
      props: {
        id: "storage-meter",
        min: 0,
        max: 100,
        value: 72,
        low: 25,
        high: 80,
        optimum: 60,
        "aria-labelledby": "storage-label",
        "aria-valuetext": "72 gigabytes used",
      },
      slots: { default: "72 of 100 gigabytes" },
    });
    const meter = findOpeningTag(html, "meter", "data-ormo-meter");

    expect(meter).toContain('id="storage-meter"');
    expect(meter).toContain('min="0"');
    expect(meter).toContain('max="100"');
    expect(meter).toContain('value="72"');
    expect(meter).toContain('low="25"');
    expect(meter).toContain('high="80"');
    expect(meter).toContain('optimum="60"');
    expect(meter).toContain('aria-labelledby="storage-label"');
    expect(meter).toContain('aria-valuetext="72 gigabytes used"');
    expect(html).toContain("72 of 100 gigabytes");
  });

  it("owns its marker and forwards native attributes", async () => {
    const html = await container.renderToString(Meter, {
      props: {
        class: "storage",
        style: "inline-size: 10rem",
        value: 0.5,
        "data-ormo-meter": "spoofed",
        "data-tracking-id": "storage-1",
      },
    });
    const meter = findOpeningTag(html, "meter", "data-ormo-meter");

    expect(meter.match(/data-ormo-meter(?:=|\s|>)/g)).toHaveLength(1);
    expect(meter).not.toContain('data-ormo-meter="spoofed"');
    expect(meter).toContain('class="storage"');
    expect(meter).toContain('style="inline-size: 10rem"');
    expect(meter).toContain('data-tracking-id="storage-1"');
  });
});

describe("Meter public types", () => {
  it("accepts native meter and accessible-name attributes", () => {
    const props = {
      value: 72,
      min: 0,
      max: 100,
      low: 25,
      high: 80,
      optimum: 60,
      "aria-label": "Storage used",
    } satisfies MeterProps;

    expect(props.value).toBe(72);
    expect(props.optimum).toBe(60);
  });
});
