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
const BOLD = /\*\*([^*]+)\*\*/g

// FAQ answers are plain strings so they stay translatable in one place. A link
// can be written as `[label](url)`, which reads better as anchor text, or as a
// bare URL, which keeps existing answers working. `**phrase**` emphasises a
// phrase. Markup is claimed in that order, and a span overlapping one already
// claimed stays literal text, so nothing nests.
export function parseFaqAnswer(answer: string): FaqAnswerPart[] {
  const spans: MarkupSpan[] = []
  const overlapsClaimed = (start: number, end: number) =>
    spans.some((span) => start < span.end && end > span.start)

  for (const match of answer.matchAll(MARKDOWN_LINK)) {
    const start = match.index
    spans.push({
      start,
      end: start + match[0].length,
      part: { type: 'link', value: match[2], label: match[1] }
    })
  }

  for (const match of answer.matchAll(BOLD)) {
    const start = match.index
    const end = start + match[0].length
    if (overlapsClaimed(start, end)) continue
    spans.push({ start, end, part: { type: 'strong', value: match[1] } })
  }

  for (const match of answer.matchAll(BARE_URL)) {
    const start = match.index
    const url = match[0].replace(/[.,;:]+$/, '')
    const end = start + url.length
    if (overlapsClaimed(start, end)) continue
    spans.push({ start, end, part: { type: 'link', value: url } })
  }

  spans.sort((a, b) => a.start - b.start)

  const parts: FaqAnswerPart[] = []
  let lastIndex = 0
  for (const span of spans) {
    if (span.start > lastIndex) {
      parts.push({ type: 'text', value: answer.slice(lastIndex, span.start) })
    }
    parts.push(span.part)
    lastIndex = span.end
  }
  if (lastIndex < answer.length) {
    parts.push({ type: 'text', value: answer.slice(lastIndex) })
  }
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
