import { t } from '@/i18n'
import { useExtensionService } from '@/services/extensionService'
import type { ActionBarButton } from '@/types/comfy'

const buttons: ActionBarButton[] = [
  {
    icon: 'icon-[lucide--share-2]',
    label: t('actionbar.share'),
    tooltip: t('actionbar.shareTooltip'),
    onClick: async () => {
      const { useShareDialog } =
        await import('@/platform/workflow/sharing/composables/useShareDialog')
      useShareDialog().show()
    }
  }
]

useExtensionService().registerExtension({
  name: 'Comfy.ShareWorkflowButton',
  actionBarButtons: buttons
})
