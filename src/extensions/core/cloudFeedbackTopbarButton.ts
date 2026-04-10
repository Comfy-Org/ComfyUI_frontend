import { t } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useExtensionService } from '@/services/extensionService'
import type { ActionBarButton } from '@/types/comfy'

const TYPEFORM_SURVEY_URL = 'https://form.typeform.com/to/q7azbWPi'

const buttons: ActionBarButton[] = [
  {
    icon: 'icon-[lucide--message-square-text]',
    label: t('actionbar.feedback'),
    tooltip: t('actionbar.feedbackTooltip'),
    onClick: () => {
      window.open(TYPEFORM_SURVEY_URL, '_blank', 'noopener,noreferrer')
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
