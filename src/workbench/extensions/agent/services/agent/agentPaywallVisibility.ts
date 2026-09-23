import type { ConversationEntry } from '../../stores/agent/agentConversationStore'

function carriesPaywall(entry: ConversationEntry): boolean {
  return (
    entry.role === 'assistant' &&
    entry.parts.some((part) => part.type === 'paywall')
  )
}

/**
 * Hides paywall parts once billing reports funds, leaving the transcript itself
 * untouched so a later admission denial — or funds running out again — shows a
 * paywall without any transition having to be observed.
 *
 * Returns the received array unchanged when nothing would be removed, so a
 * billing refresh on a paywall-free transcript costs no downstream re-render.
 */
export function hideResolvedPaywalls(
  entries: ConversationEntry[],
  fundsAvailable: boolean
): ConversationEntry[] {
  if (!fundsAvailable || !entries.some(carriesPaywall)) return entries
  return entries.flatMap((entry): ConversationEntry[] => {
    if (entry.role !== 'assistant') return [entry]
    const parts = entry.parts.filter((part) => part.type !== 'paywall')
    if (parts.length === entry.parts.length) return [entry]
    return parts.length === 0 ? [] : [{ ...entry, parts }]
  })
}
