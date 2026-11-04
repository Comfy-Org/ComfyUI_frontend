interface HighlightQueryPart {
  text: string
  highlighted: boolean
}

/**
 * Longest query that is still worth building a pattern for. The pattern is
 * roughly five times the query length, and V8 refuses to compile one much
 * beyond 26,000 characters — it throws `SyntaxError: Invalid regular
 * expression: /…/gi: Stack overflow` from the first `matchAll` step rather than
 * from the `RegExp` constructor, so a `try` around the constructor would not
 * catch it.
 */
const MAX_QUERY_LENGTH = 1024

export function highlightQuery(
  text: string,
  query: string
): HighlightQueryPart[] {
  // Every query character consumes at least one character of `text`, so a
  // query longer than the text cannot match. Bailing out keeps the pattern
  // bounded: a pasted search query used to crash the node search list with an
  // unhandled SyntaxError (Sentry CLOUD-FRONTEND-PROD-3C5).
  if (!query || query.length > text.length || query.length > MAX_QUERY_LENGTH) {
    return [{ text, highlighted: false }]
  }

  const pattern = Array.from(query)
    .map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[ ]?')

  const regex = new RegExp(pattern, 'gi')
  const parts: HighlightQueryPart[] = []
  let lastIndex = 0

  for (const match of text.matchAll(regex)) {
    if (match.index > lastIndex) {
      parts.push({
        text: text.slice(lastIndex, match.index),
        highlighted: false
      })
    }
    parts.push({ text: match[0], highlighted: true })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length || parts.length === 0) {
    parts.push({ text: text.slice(lastIndex), highlighted: false })
  }

  return parts
}
