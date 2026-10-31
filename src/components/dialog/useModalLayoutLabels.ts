import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export function useModalLayoutLabels() {
  const { t } = useI18n()
  return computed(() => ({
    showLeftPanel: t('g.showLeftPanel'),
    hideLeftPanel: t('g.hideLeftPanel'),
    showRightPanel: t('g.showRightPanel'),
    hideRightPanel: t('g.hideRightPanel'),
    close: t('g.closeDialog')
  }))
}
