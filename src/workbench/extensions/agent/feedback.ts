import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { t } from '@/i18n'
import type { FeedbackSource } from '@/platform/support/config'
import { openFeedbackDialog as openGeneralFeedbackDialog } from '@/platform/support/feedbackDialog'
import { openTypeformDialog } from '@/platform/surveys/openTypeformDialog'
import { useTelemetry } from '@/platform/telemetry'

import { useAgentConversationStore } from './stores/agent/agentConversationStore'
import { useAgentPanelStore } from './stores/agent/agentPanelStore'

export function openFeedbackDialog(source: FeedbackSource) {
  if (!useAgentPanelStore().enabled) {
    openGeneralFeedbackDialog(source)
    return
  }

  const { userEmail } = useCurrentUser()
  const hiddenFields = Object.entries({
    email: userEmail.value,
    source,
    version: __COMFYUI_FRONTEND_VERSION__,
    os: navigator.platform,
    session: useAgentConversationStore().threadId
  })
    .flatMap(([key, value]) =>
      value ? [`${key}=${value.replace(/,/g, '\\,')}`] : []
    )
    .join(',')

  useTelemetry()?.trackUiButtonClicked({
    button_id: 'feedback_button_clicked',
    element_group: source
  })
  openTypeformDialog({
    key: 'global-feedback',
    typeformId: 'MZ6cjWIB',
    title: t('feedback.title'),
    hiddenFields
  })
}
