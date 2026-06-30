import type { InjectionKey, Ref } from 'vue'
import { inject } from 'vue'

export interface ConversationContext {
  isAtBottom: Ref<boolean>
  scrollToBottom: () => void
}

export const conversationKey: InjectionKey<ConversationContext> =
  Symbol('conversation')

export function useConversation(): ConversationContext {
  const context = inject(conversationKey)
  if (!context) {
    throw new Error('Conversation parts must be used within <Conversation>')
  }
  return context
}
