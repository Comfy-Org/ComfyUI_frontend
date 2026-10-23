import { t } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { openFeedbackDialog } from '@/platform/support/feedbackDialog'
import type { ActionBarButton, ComfyExtension } from '@/types/comfy'

function feedbackButton(): ActionBarButton {
  return {
    icon: 'icon-[lucide--megaphone] size-4',
    label: t('actionbar.feedback'),
    tooltip: t('actionbar.feedbackTooltip'),
    onClick: () => openFeedbackDialog('action-bar')
  }
}

export const feedbackButtonExtension: ComfyExtension = {
  name: 'Comfy.FeedbackButton',
  get actionBarButtons() {
    return useSettingStore().get('Comfy.UI.TabBarLayout') === 'Legacy'
      ? [feedbackButton()]
      : []
  }
}
