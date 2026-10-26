import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { t } from '@/i18n'
import { openTypeformDialog } from '@/platform/surveys/openTypeformDialog'
import { useTelemetry } from '@/platform/telemetry'

import { FEEDBACK_TYPEFORM_ID, buildFeedbackHiddenFields } from './config'
import type { FeedbackSource } from './config'

export function openFeedbackDialog(
  source: FeedbackSource,
  {
    typeformId = FEEDBACK_TYPEFORM_ID,
    extraTags = {}
  }: {
    typeformId?: string
    extraTags?: Record<string, string | null | undefined>
  } = {}
) {
  const { userEmail } = useCurrentUser()

  useTelemetry()?.trackUiButtonClicked({
    button_id: 'feedback_button_clicked',
    element_group: source
  })
  openTypeformDialog({
    key: 'global-feedback',
    typeformId,
    title: t('feedback.title'),
    hiddenFields: buildFeedbackHiddenFields(
      source,
      Object.fromEntries(
        Object.entries({ email: userEmail.value, ...extraTags }).flatMap(
          ([key, value]) => (value ? [[key, value]] : [])
        )
      )
    )
  })
}
