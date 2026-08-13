export class Typeahead {
  #query = "";
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly timeout = 700) {}

  clear(): void {
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#query = "";
  }

  search<T>(
    character: string,
    items: readonly T[],
    getText: (item: T) => string,
  ): T | undefined {
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#query += character.toLocaleLowerCase();
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      this.#query = "";
    }, this.timeout);

    return items.find((item) =>
      getText(item).toLocaleLowerCase().startsWith(this.#query),
    );
  }
}
