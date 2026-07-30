import type { HTMLAttributes } from "astro/types";

export type InputType =
  | "date"
  | "datetime-local"
  | "email"
  | "month"
  | "number"
  | "password"
  | "search"
  | "tel"
  | "text"
  | "time"
  | "url"
  | "week";

export interface InputProps extends Omit<HTMLAttributes<"input">, "type"> {
  type?: InputType;
}
