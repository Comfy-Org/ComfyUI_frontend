import { useI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import type { ToastId } from '@/types/toastId'

import { isSafeExtensionBootActive } from './safeExtensionBoot'

let noticeId: ToastId | undefined

function reloadWithExtensions() {
  const url = new URL(window.location.href)
  url.searchParams.delete('safe')
  window.history.replaceState(window.history.state, '', url)
  window.location.reload()
}

/**
 * Tells the user when this load skipped custom extensions because of `?safe`.
 */
export function useSafeExtensionBootNotice() {
  if (!isSafeExtensionBootActive()) return
  const { t } = useI18n()
  noticeId = useToast().info(t('g.safeExtensionBoot.title'), {
    id: noticeId,
    description: t('g.safeExtensionBoot.description'),
    actions: [
      {
        label: t('g.safeExtensionBoot.reload'),
        onClick: reloadWithExtensions
      }
    ]
  })
}
