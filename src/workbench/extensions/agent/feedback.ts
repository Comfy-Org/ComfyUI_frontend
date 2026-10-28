import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import type { FeedbackSource } from '@/platform/support/config'
import { openFeedbackDialog as openGeneralFeedbackDialog } from '@/platform/support/feedbackDialog'

import { useAgentConversationStore } from './stores/agent/agentConversationStore'
import { useAgentPanelStore } from './stores/agent/agentPanelStore'

export function openFeedbackDialog(source: FeedbackSource) {
  if (!useAgentPanelStore().enabled) {
    openGeneralFeedbackDialog(source)
    return
  }

  const { resolvedUserInfo } = useCurrentUser()
  openGeneralFeedbackDialog(source, {
    typeformId: 'MZ6cjWIB',
    extraTags: {
      userid: resolvedUserInfo.value?.id,
      version: __COMFYUI_FRONTEND_VERSION__,
      os: navigator.platform,
      session: useAgentConversationStore().threadId
    }
  })
}
