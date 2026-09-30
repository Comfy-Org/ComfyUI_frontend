import type { CodeLang, HighlightToken } from '../../lib/highlight'
import { highlightTokens } from '../../lib/highlight'

/**
 * A segment is either static code, or a set of values the tab cycles
 * through in lockstep with every other cycling segment (index-synced, so a
 * model id and its matching prompt/filename change together).
 */
export type CodeSegment = string | { values: string[]; highlight?: boolean }

export type CodeGroup =
  | { kind: 'static'; tokens: readonly HighlightToken[] }
  | {
      kind: 'cycle'
      value: string
      highlight: boolean
      tokens: readonly HighlightToken[]
    }

function sliceTokens(
  tokens: readonly HighlightToken[],
  start: number,
  end: number
): HighlightToken[] {
  const sliced: HighlightToken[] = []
  let position = 0
  for (const token of tokens) {
    const tokenStart = position
    const tokenEnd = position + token.content.length
    position = tokenEnd
    if (tokenEnd <= start || tokenStart >= end) continue
    const content = token.content.slice(
      Math.max(start, tokenStart) - tokenStart,
      Math.min(end, tokenEnd) - tokenStart
    )
    if (content) sliced.push({ content, color: token.color })
  }
  return sliced
}

/**
 * Highlights the whole sample as one program so string and call boundaries
 * that straddle segments still tokenize correctly, then hands each segment
 * back its own slice of the tokens so cycling segments can keep their
 * crossfade and emphasis.
 */
export function tokenizeSegments(
  segments: readonly CodeSegment[],
  lang: CodeLang,
  pick: (values: string[]) => string
): CodeGroup[] {
  const resolved = segments.map((segment) =>
    typeof segment === 'string'
      ? { text: segment }
      : { text: pick(segment.values), highlight: segment.highlight === true }
  )
  const tokens = highlightTokens(
    resolved.map(({ text }) => text).join(''),
    lang
  )

  let offset = 0
  return resolved.map((segment): CodeGroup => {
    const start = offset
    offset += segment.text.length
    const sliced = tokens
      ? sliceTokens(tokens, start, offset)
      : [{ content: segment.text }]
    return segment.highlight === undefined
      ? { kind: 'static', tokens: sliced }
      : {
          kind: 'cycle',
          value: segment.text,
          highlight: segment.highlight,
          tokens: sliced
        }
  })
}
