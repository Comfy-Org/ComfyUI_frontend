import { useI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'

import { isSafeExtensionBootActive } from './safeExtensionBoot'

/**
 * Tells the user when this load skipped custom extensions because of `?safe`.
 * The flag is already gone from the URL, so a plain reload brings them back.
 */
export function useSafeExtensionBootNotice() {
  if (!isSafeExtensionBootActive()) return
  const { t } = useI18n()
  useToast().info(t('g.safeExtensionBoot.title'), {
    description: t('g.safeExtensionBoot.description'),
    actions: [
      {
        label: t('g.safeExtensionBoot.reload'),
        onClick: () => window.location.reload()
      }
    ]
  })
}
