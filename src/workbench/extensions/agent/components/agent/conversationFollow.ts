import type { InjectionKey } from 'vue'

interface ConversationFollow {
  pauseForTrace: (traceId: string) => void
  traceSettled: (traceId: string) => void
}

export const conversationFollowKey: InjectionKey<ConversationFollow> =
  Symbol('conversationFollow')
