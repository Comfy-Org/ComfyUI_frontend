import { effectScope, watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { useAgentWorkflowTabBindingStore } from '../../stores/agent/agentWorkflowTabBindingStore'
import { forgetAgentSessionMemory } from './agentSessionMemory'

export function registerAgentIdentityStateTracker(): () => void {
  const scope = effectScope(true)

  scope.run(() => {
    const { resolvedUserInfo } = useCurrentUser()

    watch(
      () => resolvedUserInfo.value?.id ?? null,
      (_userId, previousUserId) => {
        if (previousUserId === null) return

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
      }
    )
  })

  return () => scope.stop()
}
