import { t } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { FEEDBACK_TYPEFORM_URL } from '@/platform/support/config'
import { useExtensionService } from '@/services/extensionService'
import type { ActionBarButton } from '@/types/comfy'

const buttons: ActionBarButton[] = [
  {
    icon: 'icon-[lucide--message-square-text]',
    label: t('actionbar.feedback'),
    tooltip: t('actionbar.feedbackTooltip'),
    onClick: () => {
      window.open(FEEDBACK_TYPEFORM_URL, '_blank', 'noopener,noreferrer')
    }
  }
]

useExtensionService().registerExtension({
  name: 'Comfy.FeedbackButton',
  get actionBarButtons() {
    return useSettingStore().get('Comfy.UI.TabBarLayout') === 'Legacy'
      ? buttons
      : []
  }
})
