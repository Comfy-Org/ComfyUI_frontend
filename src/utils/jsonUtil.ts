/**
 * Parse JSON that may contain bare `NaN`/`Infinity`/`-Infinity` tokens
 * (which Python's `json.dumps` emits) by replacing them with `null` on
 * fallback. Coercion is lossy; a one-time warning is logged when it fires.
 */
export function parseJsonWithNonFinite<T = unknown>(text: string): T {
  try {
    return JSON.parse(text) as T
  } catch {
    return JSON.parse(replaceNonFiniteTokens(text)) as T
  }
}

// Match a JSON string OR a non-finite token outside string.
// - `"(?:\\.|[^"\\])*"`  a quoted string - matched first so anything that
//                        looks like a token inside a string is skipped
// - `(?<![\w.-])`        skip non bare tokens (e.g. 1NaN)
// - `(-?Infinity|NaN)`   capture the non-finite token
// - `(?![\w.])`          skip non bare suffix tokens (e.g. NaN1)
const NON_FINITE_TOKEN =
  /"(?:\\.|[^"\\])*"|(?<![\w.-])(-?Infinity|NaN)(?![\w.])/g

function replaceNonFiniteTokens(text: string): string {
  let hasWarned = false
  return text.replace(NON_FINITE_TOKEN, (match, token) => {
    if (token) {
      if (!hasWarned) {
        console.warn(
          'JSON contained non-finite numeric tokens (NaN/Infinity); they were replaced with null.'
        )
        hasWarned = true
      }
      return 'null'
    }
    return match
  })
}
