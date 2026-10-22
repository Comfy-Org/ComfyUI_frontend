import { t } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { openFeedbackDialog } from '@/platform/support/feedbackDialog'
import { useExtensionService } from '@/services/extensionService'
import type { ActionBarButton } from '@/types/comfy'

function feedbackButton(): ActionBarButton {
  return {
    icon: 'icon-[lucide--megaphone] size-4',
    label: t('actionbar.feedback'),
    tooltip: t('actionbar.feedbackTooltip'),
    onClick: () => openFeedbackDialog('action-bar')
  }
}

useExtensionService().registerExtension({
  name: 'Comfy.FeedbackButton',
  get actionBarButtons() {
    return useSettingStore().get('Comfy.UI.TabBarLayout') === 'Legacy'
      ? [feedbackButton()]
      : []
  }
})
