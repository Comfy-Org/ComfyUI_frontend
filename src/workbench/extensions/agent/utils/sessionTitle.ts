import { once } from 'es-toolkit'

import type { HistoryGroups } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import type { ConversationEntry } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'

const MAX_DERIVED_TITLE_LENGTH = 60

const graphemeSegmenter = once(
  () => new Intl.Segmenter(undefined, { granularity: 'grapheme' })
)

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
    Array.from(graphemeSegmenter().segment(text), ({ segment }) => segment)
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
