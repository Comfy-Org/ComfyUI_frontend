import type { ConversationEntry } from '../stores/agent/agentConversationStore'

const MAX_DERIVED_TITLE_LENGTH = 60

/**
 * Placeholder title for an untitled thread: the first user message, trimmed
 * and truncated. Used until the server's asynchronous title generation
 * lands, which happens off the critical path with no push notification when
 * it completes (see `agentChatHistoryStore`'s `patchTitle`).
 */
export function deriveSessionTitle(
  entries: ConversationEntry[]
): string | undefined {
  const firstUser = entries.find(
    (entry): entry is Extract<ConversationEntry, { role: 'user' }> =>
      entry.role === 'user'
  )
  return firstUser?.text.trim().slice(0, MAX_DERIVED_TITLE_LENGTH) || undefined
}
