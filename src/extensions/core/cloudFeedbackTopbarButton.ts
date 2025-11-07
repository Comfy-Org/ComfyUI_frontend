import { t } from '@/i18n'
import { useExtensionService } from '@/services/extensionService'
import type { ActionBarButton } from '@/types/comfy'

// Zendesk feedback URL - update this with the actual URL
const ZENDESK_FEEDBACK_URL =
  'https://comfyorg.zendesk.com/hc/en-us/requests/new'

const buttons: ActionBarButton[] = [
  {
    icon: 'icon-[lucide--message-circle-question-mark]',
    label: t('g.feedback'),
    tooltip: t('g.feedback'),
    onClick: () => {
      window.open(ZENDESK_FEEDBACK_URL, '_blank', 'noopener,noreferrer')
    }
  }
]

useExtensionService().registerExtension({
  name: 'Comfy.Cloud.FeedbackButton',
  get actionBarButtons() {
    return buttons
  }
})
