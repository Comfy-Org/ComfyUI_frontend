import type { HistoryGroups } from '../stores/agent/agentChatHistoryStore'
import type { ConversationEntry } from '../stores/agent/agentConversationStore'

const MAX_DERIVED_TITLE_LENGTH = 60

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/** First user message, trimmed and capped at 60 graphemes. */
export function deriveSessionTitle(
  entries: ConversationEntry[]
): string | undefined {
  const firstUser = entries.find(
    (entry): entry is Extract<ConversationEntry, { role: 'user' }> =>
      entry.role === 'user'
  )
  const text = firstUser?.text.trim() ?? ''
  return (
    Array.from(graphemes.segment(text), ({ segment }) => segment)
      .slice(0, MAX_DERIVED_TITLE_LENGTH)
      .join('')
      .trimEnd() || undefined
  )
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
