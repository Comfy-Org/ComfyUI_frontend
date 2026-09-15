/**
 * Bold markers a Markdown renderer will refuse to close.
 *
 * CommonMark decides what a `**` can do from the characters around it. A run
 * can close emphasis only if it is "right-flanking": not preceded by
 * whitespace, and either not preceded by punctuation, or followed by whitespace
 * or punctuation.
 *
 * English rarely trips this, because a bolded phrase ends in a letter. Japanese
 * trips it constantly: a bolded clause ends in 。 or ）, and the next word runs
 * straight on with no space. `/ja/pricing` shipped two. One printed its
 * asterisks on the page. The other was worse — the closing run was read as a
 * second *opening* run, so a paragraph meant to be plain rendered bold, and the
 * `<strong>` tags still balanced, which is why no structural check noticed.
 *
 * Reported so `enforce` can drop the string to English rather than publish
 * markup that does not mean what it says.
 */

const isSpace = (character: string) => /\s/.test(character)

// Unicode punctuation, plus the ASCII symbols CommonMark counts alongside it.
const isPunctuation = (character: string) => /[\p{P}\p{S}]/u.test(character)

/** Whether a delimiter at this position could close emphasis. */
function canClose(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text[start - 1] : ''
  const after = end < text.length ? text[end] : ''
  if (before === '' || isSpace(before)) return false
  if (!isPunctuation(before)) return true
  return after === '' || isSpace(after) || isPunctuation(after)
}

/** Whether a delimiter at this position could open emphasis. */
function canOpen(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text[start - 1] : ''
  const after = end < text.length ? text[end] : ''
  if (after === '' || isSpace(after)) return false
  if (!isPunctuation(after)) return true
  return before === '' || isSpace(before) || isPunctuation(before)
}

/**
 * The spans whose closing `**` cannot close, each rendered as the text from the
 * opening delimiter to just past the failed one, so the report shows the copy
 * rather than an offset.
 */
export function emphasisThatCannotClose(text: string): string[] {
  const runs = [...text.matchAll(/\*\*/g)]
  const broken: string[] = []
  let openAt: number | undefined

  for (const run of runs) {
    const start = run.index
    const end = start + run[0].length

    if (openAt === undefined) {
      if (canOpen(text, start, end)) openAt = start
      continue
    }

    if (canClose(text, start, end)) {
      openAt = undefined
      continue
    }

    // Still open, and this run cannot close it. Report the span and resume
    // from here, since the renderer treats this run as a fresh opener.
    broken.push(text.slice(openAt, Math.min(text.length, end + 8)))
    openAt = canOpen(text, start, end) ? start : undefined
  }

  return broken
}
