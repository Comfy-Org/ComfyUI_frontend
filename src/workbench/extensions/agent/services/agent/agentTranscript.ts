import type { ConversationEntry } from '../../stores/agent/agentConversationStore'

/**
 * Serialize a conversation into a plain-markdown transcript for the copy-as-markdown row
 * action. V0 limitation: only the CURRENT in-memory conversation has entries to serialize;
 * past sessions are not persisted yet, so the caller copies this only for the active session
 * and toasts an unavailable notice otherwise.
 *
 * User turns render as '**You:** text'; assistant turns concatenate their text parts (tool,
 * reasoning, notice, and file parts have no plain-markdown body and are skipped).
 */
export function buildTranscriptMarkdown(entries: ConversationEntry[]): string {
  return entries
    .map((entry) => {
      if (entry.role === 'user') return `**You:** ${entry.text}`
      const text = entry.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('')
      return `**Agent:** ${text}`
    })
    .join('\n\n')
}
