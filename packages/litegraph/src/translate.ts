type Translator = (key: string, fallback: string) => string

let translator: Translator | undefined

/** Registers the app translator for litegraph's labels. */
export function provideTranslator(next: Translator | undefined): void {
  translator = next
}

/** Translates `key`, or returns the English `fallback` when no translator is registered. */
export function translate(key: string, fallback: string): string {
  return translator ? translator(key, fallback) : fallback
}
