import { once } from 'es-toolkit'

import type { HistoryGroups } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import type { ConversationEntry } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'

const MAX_DERIVED_TITLE_LENGTH = 60

const graphemeSegmenter = once(() => {
  // oxlint-disable-next-line no-restricted-properties
  const Segmenter = Intl.Segmenter
  return typeof Segmenter === 'function'
    ? new Segmenter(undefined, { granularity: 'grapheme' })
    : undefined
})

function truncatedTitle(text: string): string {
  const segmenter = graphemeSegmenter()
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
