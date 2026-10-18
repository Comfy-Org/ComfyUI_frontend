export interface FaqAnswerPart {
  type: 'text' | 'link' | 'strong'
  value: string
  label?: string
}

interface MarkupSpan {
  start: number
  end: number
  part: FaqAnswerPart
}

const MARKDOWN_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
const BARE_URL = /https?:\/\/[\w\-./?=&#%~:@+,;]+/g
// Group 1 is the character preceding `**` — captured, not looked behind, so the
// pattern still parses on Safari < 16.4. Opening away from a word character and
// refusing whitespace just inside the delimiters stops a stray `**` pairing with
// a later one and emphasising everything between (e.g. `$10**, $20**`).
const BOLD = /(^|[^\w])\*\*(?![\s*])([^*\n]*[^\s*])\*\*/g
const BOLD_DELIMITER = '**'

const withoutBoldDelimiters = (text: string) =>
  text.replaceAll(BOLD_DELIMITER, '')

// FAQ answers are plain strings so they stay translatable in one place. A link
// can be written as `[label](url)`, which reads better as anchor text, or as a
// bare URL, which keeps existing answers working. `**phrase**` emphasises a
// phrase. Both link forms are claimed before emphasis and nothing nests, so a
// bold span overlapping a link keeps the link and loses its emphasis. Either
// way the delimiters are stripped, so no `**` reaches the page or the
// structured data.
export function parseFaqAnswer(answer: string): FaqAnswerPart[] {
  const spans: MarkupSpan[] = []
  const overlapsClaimed = (start: number, end: number) =>
    spans.some((span) => start < span.end && end > span.start)

  for (const match of answer.matchAll(MARKDOWN_LINK)) {
    const start = match.index
    spans.push({
      start,
      end: start + match[0].length,
      part: {
        type: 'link',
        value: match[2],
        label: withoutBoldDelimiters(match[1]) || undefined
      }
    })
  }

  for (const match of answer.matchAll(BARE_URL)) {
    const start = match.index
    const url = match[0].replace(/[.,;:]+$/, '')
    const end = start + url.length
    if (overlapsClaimed(start, end)) continue
    spans.push({ start, end, part: { type: 'link', value: url } })
  }

  for (const match of answer.matchAll(BOLD)) {
    const start = match.index + match[1].length
    const end = start + match[0].length - match[1].length
    if (overlapsClaimed(start, end)) continue
    spans.push({ start, end, part: { type: 'strong', value: match[2] } })
  }

  spans.sort((a, b) => a.start - b.start)

  const parts: FaqAnswerPart[] = []
  const pushText = (value: string) => {
    const text = withoutBoldDelimiters(value)
    if (text) parts.push({ type: 'text', value: text })
  }

  let lastIndex = 0
  for (const span of spans) {
    if (span.start > lastIndex) pushText(answer.slice(lastIndex, span.start))
    parts.push(span.part)
    lastIndex = span.end
  }
  pushText(answer.slice(lastIndex))
  return parts
}

// Structured data carries what the reader sees, so link markup is flattened to
// its anchor text rather than emitted as raw markdown.
export function faqAnswerPlainText(answer: string): string {
  return parseFaqAnswer(answer)
    .map((part) =>
      part.type === 'link' ? (part.label ?? part.value) : part.value
    )
    .join('')
}
