import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import type { FeedbackSource } from '@/platform/support/config'
import { openFeedbackDialog as openGeneralFeedbackDialog } from '@/platform/support/feedbackDialog'

import { agentClientSessionId } from './agentClientSession'
import { useAgentComposerStore } from './stores/agent/agentComposerStore'
import { useAgentConsentStore } from './stores/agent/agentConsentStore'
import { useAgentConversationStore } from './stores/agent/agentConversationStore'
import { useAgentPanelStore } from './stores/agent/agentPanelStore'

function consentState(signedIn: boolean) {
  const consent = useAgentConsentStore()
  if (consent.accepted) return 'accepted'
  if (!signedIn) return 'signed_out'
  if (consent.isChecking) return 'unchecked'
  return consent.checkFailed ? 'check_failed' : 'not_accepted'
}

export function openFeedbackDialog(source: FeedbackSource) {
  if (!useAgentPanelStore().enabled) {
    openGeneralFeedbackDialog(source)
    return
  }

  const { resolvedUserInfo } = useCurrentUser()
  const { heldSendGate } = useAgentPanelStore()
  openGeneralFeedbackDialog(source, {
    typeformId: 'MZ6cjWIB',
    extraTags: {
      userid: resolvedUserInfo.value?.id,
      version: __COMFYUI_FRONTEND_VERSION__,
      os: navigator.platform,
      session: useAgentConversationStore().threadId,
      client: agentClientSessionId(),
      consent: consentState(Boolean(resolvedUserInfo.value?.id)),
      held: heldSendGate ?? 'none',
      composer: useAgentComposerStore().submission?.phase ?? 'idle'
    }
  })
}
