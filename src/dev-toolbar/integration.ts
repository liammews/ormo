import type { AstroIntegration } from "astro";

export function ormoDevToolbar(): AstroIntegration {
  return {
    name: "@ormo/primitives/dev-toolbar",
    hooks: {
      "astro:config:setup": ({ addDevToolbarApp }) => {
        addDevToolbarApp({
          id: "ormo",
          name: "Ormo",
          icon: "check-circle",
          entrypoint: new URL("./app.ts", import.meta.url),
        });
      },
    },
  };
}

export default ormoDevToolbar;
