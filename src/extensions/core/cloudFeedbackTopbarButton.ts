import { t } from '@/i18n'
import { useExtensionService } from '@/services/extensionService'
import type { ActionBarButton } from '@/types/comfy'

// Zendesk feedback URL - update this with the actual URL
const ZENDESK_FEEDBACK_URL =
  'https://support.comfy.org/hc/en-us/requests/new?ticket_form_id=43066738713236'

const buttons: ActionBarButton[] = [
  {
    icon: 'icon-[lucide--message-circle-question-mark]',
    label: t('actionbar.feedback'),
    tooltip: t('actionbar.feedbackTooltip'),
    onClick: () => {
      window.open(ZENDESK_FEEDBACK_URL, '_blank', 'noopener,noreferrer')
    }
  }
]

useExtensionService().registerExtension({
  name: 'Comfy.Cloud.FeedbackButton',
  actionBarButtons: buttons
})
