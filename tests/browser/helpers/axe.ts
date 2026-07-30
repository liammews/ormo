import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

interface AxeOptions {
  include?: string | string[];
  label?: string;
}

export async function expectNoAxeViolations(
  page: Page,
  { include, label = "page" }: AxeOptions = {},
): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(wcagTags);
  const selectors = Array.isArray(include) ? include : include ? [include] : [];

  for (const selector of selectors) {
    builder = builder.include(selector);
  }

  const results = await builder.analyze();
  expect(results.violations, label).toEqual([]);
}
