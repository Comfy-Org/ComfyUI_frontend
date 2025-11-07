import type { ActionBarButton } from '@/types/comfy'
import { useExtensionService } from '@/services/extensionService'

// Zendesk feedback URL - update this with the actual URL
const ZENDESK_FEEDBACK_URL =
  'https://comfyorg.zendesk.com/hc/en-us/requests/new'

const buttons: ActionBarButton[] = [
  {
    icon: 'icon-[lucide--message-circle-question-mark]',
    label: 'Feedback',
    tooltip: 'Feedback',
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
