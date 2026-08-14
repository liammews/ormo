import { experimental_AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";

import Progress from "../../src/components/progress/Progress.astro";
import type { ProgressProps } from "../../src/components/progress/types";
import { findOpeningTag } from "./helpers/astro";

describe("Progress markup", () => {
  let container: Awaited<ReturnType<typeof experimental_AstroContainer.create>>;

  beforeAll(async () => {
    container = await experimental_AstroContainer.create();
  });

  it("renders determinate native progress semantics", async () => {
    const html = await container.renderToString(Progress, {
      props: {
        id: "upload-progress",
        value: 3,
        max: 8,
        "aria-labelledby": "upload-label",
        "aria-valuetext": "3 of 8 files",
      },
      slots: { default: "3 of 8 files" },
    });
    const progress = findOpeningTag(html, "progress", "data-ormo-progress");

    expect(progress).toContain('id="upload-progress"');
    expect(progress).toContain('value="3"');
    expect(progress).toContain('max="8"');
    expect(progress).toContain('aria-labelledby="upload-label"');
    expect(progress).toContain('aria-valuetext="3 of 8 files"');
    expect(html).toContain("3 of 8 files");
  });

  it("renders indeterminate state when value is absent", async () => {
    const html = await container.renderToString(Progress, {
      props: { "aria-label": "Preparing download" },
    });
    const progress = findOpeningTag(html, "progress", "data-ormo-progress");

    expect(progress).toContain('aria-label="Preparing download"');
    expect(progress).not.toMatch(/\svalue=/);
    expect(progress).not.toMatch(/\smax=/);
  });

  it("owns its component marker and forwards native attributes", async () => {
    const html = await container.renderToString(Progress, {
      props: {
        class: "upload",
        style: "inline-size: 10rem",
        max: 100,
        "data-ormo-progress": "spoofed",
        "data-tracking-id": "upload-1",
      },
    });
    const progress = findOpeningTag(html, "progress", "data-ormo-progress");

    expect(progress.match(/data-ormo-progress(?:=|\s|>)/g)).toHaveLength(1);
    expect(progress).not.toContain('data-ormo-progress="spoofed"');
    expect(progress).toContain('class="upload"');
    expect(progress).toContain('style="inline-size: 10rem"');
    expect(progress).toContain('data-tracking-id="upload-1"');
  });
});

describe("Progress public types", () => {
  it("accepts native progress and accessible-name attributes", () => {
    const props = {
      value: 3,
      max: 8,
      "aria-label": "File upload",
      "aria-valuetext": "3 of 8 files",
    } satisfies ProgressProps;

    expect(props).toEqual({
      value: 3,
      max: 8,
      "aria-label": "File upload",
      "aria-valuetext": "3 of 8 files",
    });
  });
});
