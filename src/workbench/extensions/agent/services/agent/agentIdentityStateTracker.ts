import { effectScope, watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { useAgentWorkflowTabBindingStore } from '../../stores/agent/agentWorkflowTabBindingStore'
import { useAgentChatHistoryStore } from '../../stores/agent/agentChatHistoryStore'
import { useAgentRunModeStore } from '../../stores/agent/agentRunModeStore'
import {
  forgetAgentSessionMemory,
  hasAgentSessionMemoryFor
} from './agentSessionMemory'

export function registerAgentIdentityStateTracker(): () => void {
  const scope = effectScope(true)

  scope.run(() => {
    const { resolvedUserInfo } = useCurrentUser()

    watch(
      () => resolvedUserInfo.value?.id ?? null,
      (userId, previousUserId) => {
        if (previousUserId === undefined && userId === null) return
        if (
          (previousUserId === undefined || previousUserId === null) &&
          hasAgentSessionMemoryFor(userId)
        ) {
          return
        }

        const conversation = useAgentConversationStore()
        conversation.abortActiveTurn()
        conversation.dropBackgroundTurns()
        conversation.reset()

        const composer = useAgentComposerStore()
        for (const attachment of composer.attachments) {
          if (attachment.previewUrl?.startsWith('blob:'))
            URL.revokeObjectURL(attachment.previewUrl)
        }
        composer.draft = ''
        composer.attachments = []

        forgetAgentSessionMemory()
        useAgentWorkflowTabBindingStore().clear()
        useAgentChatHistoryStore().clear()
        const runMode = useAgentRunModeStore()
        runMode.reset()
        if (userId !== null) void runMode.load()
      },
      { immediate: true }
    )
  })

  return () => scope.stop()
}
