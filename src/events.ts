export interface OrmoValueChangeDetail {
  value: string | string[] | null;
  reason?: "member" | "parent" | "programmatic";
}

export type OrmoValueChangeEvent = CustomEvent<OrmoValueChangeDetail>;

declare global {
  interface GlobalEventHandlersEventMap {
    "ormo:value-change": OrmoValueChangeEvent;
  }
}
