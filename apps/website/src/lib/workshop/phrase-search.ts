function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

/** Whether every word of the search appears somewhere in the phrase. */
export function phraseMatches(phrase: string, query: string): boolean {
  const needles = wordsOf(query)
  const haystack = phrase.toLowerCase()
  return (
    needles.length > 0 && needles.every((needle) => haystack.includes(needle))
  )
}
