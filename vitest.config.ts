import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["tests/unit/**/*.astro.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/runtime/collection-navigation.ts",
        "src/runtime/field-form.ts",
        "src/runtime/field-relationships.ts",
        "src/runtime/field-validation.ts",
        "src/runtime/focus.ts",
        "src/runtime/popup-transition.ts",
        "src/runtime/typeahead.ts",
      ],
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage/runtime",
      thresholds: {
        statements: 85,
        branches: 72,
        functions: 95,
        lines: 87,
      },
    },
  },
});
