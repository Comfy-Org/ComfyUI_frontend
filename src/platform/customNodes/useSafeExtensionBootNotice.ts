import { useI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import type { ToastId } from '@/types/toastId'

import { isSafeExtensionBootActive } from './safeExtensionBoot'

let noticeId: ToastId | undefined

function reloadWithExtensions() {
  const url = new URL(window.location.href)
  url.searchParams.delete('safe')
  window.location.replace(url.toString())
}

/**
 * Tells the user when this load skipped custom extensions because of `?safe`.
 * Called from the graph view's setup: a layout swap clears every toast, so the
 * view that shows the graph re-shows it, replacing any copy still on screen.
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
