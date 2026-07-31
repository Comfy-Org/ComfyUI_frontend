import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { t } from '@/i18n'
import { openTypeformDialog } from '@/platform/surveys/openTypeformDialog'
import { useTelemetry } from '@/platform/telemetry'

import { FEEDBACK_TYPEFORM_ID, buildFeedbackHiddenFields } from './config'
import type { FeedbackSource } from './config'

export function openFeedbackDialog(source: FeedbackSource) {
  const { userEmail } = useCurrentUser()

  useTelemetry()?.trackUiButtonClicked({
    button_id: 'feedback_button_clicked',
    element_group: source
  })
  openTypeformDialog({
    key: 'global-feedback',
    typeformId: FEEDBACK_TYPEFORM_ID,
    title: t('feedback.title'),
    hiddenFields: buildFeedbackHiddenFields(
      source,
      userEmail.value ? { email: userEmail.value } : {}
    )
  })
}
