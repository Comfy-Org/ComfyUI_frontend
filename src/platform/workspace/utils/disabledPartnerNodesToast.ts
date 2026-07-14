import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'

export function showDisabledNodesToast(offenderCount: number): void {
  useToastStore().add({
    severity: 'error',
    group: 'disabled-nodes',
    summary: t('rightSidePanel.disabledNodes.title', offenderCount),
    detail: t('rightSidePanel.disabledNodes.toastDetail', offenderCount),
    life: 10000
  })
}
