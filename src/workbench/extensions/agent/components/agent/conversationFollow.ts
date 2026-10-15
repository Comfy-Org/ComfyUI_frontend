import type { InjectionKey } from 'vue'

interface ConversationFollow {
  pauseForTrace: () => void
  traceSettled: () => void
}

export const conversationFollowKey: InjectionKey<ConversationFollow> =
  Symbol('conversationFollow')
