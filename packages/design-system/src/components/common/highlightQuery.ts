interface HighlightQueryPart {
  text: string
  highlighted: boolean
}

export function highlightQuery(
  text: string,
  query: string
): HighlightQueryPart[] {
  if (!query) return [{ text, highlighted: false }]

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
