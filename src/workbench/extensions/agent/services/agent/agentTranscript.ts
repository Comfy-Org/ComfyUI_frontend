import type { ConversationEntry } from '../../stores/agent/agentConversationStore'

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
