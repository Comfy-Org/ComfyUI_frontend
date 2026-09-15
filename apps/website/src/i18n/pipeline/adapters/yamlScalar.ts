/**
 * A double-quoted YAML scalar, and its exact inverse.
 *
 * The story writer and the FAQ writer each had their own half of this and the
 * halves disagreed. The FAQ writer escaped `"` but not `\`, so a value holding
 * a backslash wrote an invalid escape — `question: "50\% off"` — and corrupted
 * the frontmatter of the file it had just produced. Neither writer escaped a
 * newline, which ends the line the scalar sits on, so the question regex stopped
 * matching and the writer threw `no double-quoted question` while verifying its
 * own output: a parse failure reported in place of the real problem.
 *
 * Both also escaped more on the way out than they reversed on the way back —
 * only `\"` was undone — so a value carrying a backslash came back with it
 * doubled, and doubled again on every later pass.
 *
 * Kept as a pair in one file because that is the property that matters: quoting
 * and unquoting have to move together or the round trip stops being one.
 */

/** Escape a value for use inside `field: "..."`. */
export function quoteYamlScalar(value: string): string {
  // Backslash first. Doing it after would also escape the backslashes this
  // function just introduced for the quotes.
  const escaped = value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\n', '\\n')
  return `"${escaped}"`
}

/** Recover the value from the inside of a double-quoted scalar. */
export function unquoteYamlScalar(quoted: string): string {
  // One pass, so an escaped backslash cannot have its second character read as
  // the start of another escape. Replacing sequentially would turn `\\n` — an
  // escaped backslash followed by `n` — into a newline.
  return quoted.replace(/\\(.)/g, (_, character: string) =>
    character === 'n' ? '\n' : character
  )
}
