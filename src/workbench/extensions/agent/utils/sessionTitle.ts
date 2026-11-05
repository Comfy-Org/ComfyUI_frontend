import type { HistoryGroups } from '../stores/agent/agentChatHistoryStore'
import type { ConversationEntry } from '../stores/agent/agentConversationStore'

const MAX_DERIVED_TITLE_LENGTH = 60

let graphemeSegmenter: Intl.Segmenter | undefined | null = null

/** Built on first use; undefined when the browser lacks `Intl.Segmenter`. */
function getGraphemeSegmenter(): Intl.Segmenter | undefined {
  if (graphemeSegmenter === null) {
    graphemeSegmenter =
      typeof Intl.Segmenter === 'function'
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        : undefined
  }
  return graphemeSegmenter
}

function truncatedTitle(text: string): string {
  const segmenter = getGraphemeSegmenter()
  const title: string[] = []

  for (const item of segmenter ? segmenter.segment(text) : text) {
    const segment = typeof item === 'string' ? item : item.segment
    title.push(segment)
    if (title.length === MAX_DERIVED_TITLE_LENGTH) break
  }

  return title.join('').trimEnd()
}

/**
 * First user message, trimmed and capped at 60 graphemes, or 60 Unicode code
 * points when the browser does not provide `Intl.Segmenter`.
 */
export function deriveSessionTitle(
  entries: ConversationEntry[]
): string | undefined {
  const firstUser = entries.find(
    (entry): entry is Extract<ConversationEntry, { role: 'user' }> =>
      entry.role === 'user'
  )
  const text = firstUser?.text.trim() ?? ''
  return truncatedTitle(text) || undefined
}

export function withCurrentSessionTitle(
  groups: HistoryGroups,
  title: string | undefined
): HistoryGroups {
  if (!title) return groups
  return {
    ...groups,
    current: groups.current.map((session) =>
      session.titleSource === 'fallback' ? { ...session, title } : session
    )
  }
}
