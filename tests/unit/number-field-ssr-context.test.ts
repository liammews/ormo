import { expect, it } from "vitest";
import {
  getNumberFieldSsrContext,
  renderWithNumberFieldContext,
} from "../../src/internal/number-field-ssr-context";

it("isolates nested Number Field SSR contexts", async () => {
  expect(getNumberFieldSsrContext()).toBeUndefined();
  await renderWithNumberFieldContext(
    {
      value: 2,
      min: 0,
      max: 10,
      step: 1,
      name: "quantity",
      form: undefined,
      disabled: false,
      readOnly: false,
      required: true,
    },
    async () => {
      expect(getNumberFieldSsrContext()?.value).toBe(2);
      await renderWithNumberFieldContext(
        {
          value: 5,
          min: undefined,
          max: undefined,
          step: "any",
          name: undefined,
          form: undefined,
          disabled: true,
          readOnly: false,
          required: false,
        },
        async () => {
          expect(getNumberFieldSsrContext()?.value).toBe(5);
          return "";
        },
      );
      expect(getNumberFieldSsrContext()?.value).toBe(2);
      return "";
    },
  );
  expect(getNumberFieldSsrContext()).toBeUndefined();
});
