import { safeLocalStorage } from '@/base/storage/safeStorage'
import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'

let memoryOnlyFailureShown = false

/** Shows the failed-draft toast; only once per page while storage is memory-only. */
export function showDraftSaveFailedToast(): void {
  if (!safeLocalStorage.isPersistent) {
    if (memoryOnlyFailureShown) return
    memoryOnlyFailureShown = true
  }
  useToast().error(t('g.error'), {
    description: t('toastMessages.failedToSaveDraft')
  })
}
