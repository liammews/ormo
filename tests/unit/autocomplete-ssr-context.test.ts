import { describe, expect, it } from "vitest";
import {
  autocompleteHtmlToText,
  getAutocompleteSsrContext,
  renderWithAutocompleteContext,
} from "../../src/internal/autocomplete-ssr-context";

describe("autocomplete SSR context", () => {
  it("scopes root context across asynchronous rendering", async () => {
    expect(getAutocompleteSsrContext()).toBeUndefined();
    await renderWithAutocompleteContext(
      {
        rootId: "place",
        defaultValue: "",
        required: false,
        disabled: false,
        readOnly: false,
        groupCount: 0,
      },
      async () => {
        await Promise.resolve();
        expect(getAutocompleteSsrContext()?.rootId).toBe("place");
        return "";
      },
    );
    expect(getAutocompleteSsrContext()).toBeUndefined();
  });

  it("normalizes rich HTML into text", () => {
    expect(
      autocompleteHtmlToText("<span>San&nbsp;Francisco</span> <b>CA</b>"),
    ).toBe("San Francisco CA");
  });
});
