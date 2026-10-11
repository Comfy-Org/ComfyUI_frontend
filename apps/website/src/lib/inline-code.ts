export interface InlineCodePart {
  readonly text: string
  readonly code: boolean
}

/**
 * Splits copy on backtick pairs so `code` spans can render in a monospace
 * face. An unpaired backtick leaves the whole string as prose.
 */
export function splitInlineCode(text: string): InlineCodePart[] {
  const segments = text.split('`')
  if (segments.length % 2 === 0) return [{ text, code: false }]
  return segments
    .map((segment, index) => ({ text: segment, code: index % 2 === 1 }))
    .filter((part) => part.text)
}
