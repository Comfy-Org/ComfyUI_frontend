export interface FaqAnswerPart {
  type: 'text' | 'link'
  value: string
  label?: string
}

interface LinkMatch {
  start: number
  end: number
  url: string
  label?: string
}

const MARKDOWN_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
const BARE_URL = /https?:\/\/[\w\-./?=&#%~:@+,;]+/g

// FAQ answers are plain strings so they stay translatable in one place. A link
// can be written as `[label](url)`, which reads better as anchor text, or as a
// bare URL, which keeps existing answers working.
export function parseFaqAnswer(answer: string): FaqAnswerPart[] {
  const links: LinkMatch[] = []

  for (const match of answer.matchAll(MARKDOWN_LINK)) {
    const start = match.index ?? 0
    links.push({
      start,
      end: start + match[0].length,
      url: match[2],
      label: match[1]
    })
  }

  for (const match of answer.matchAll(BARE_URL)) {
    const start = match.index ?? 0
    const url = match[0].replace(/[.,;:]+$/, '')
    const insideMarkdownLink = links.some(
      (link) => start >= link.start && start < link.end
    )
    if (insideMarkdownLink) continue
    links.push({ start, end: start + url.length, url })
  }

  links.sort((a, b) => a.start - b.start)

  const parts: FaqAnswerPart[] = []
  let lastIndex = 0
  for (const link of links) {
    if (link.start > lastIndex) {
      parts.push({ type: 'text', value: answer.slice(lastIndex, link.start) })
    }
    parts.push({
      type: 'link',
      value: link.url,
      ...(link.label ? { label: link.label } : {})
    })
    lastIndex = link.end
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
