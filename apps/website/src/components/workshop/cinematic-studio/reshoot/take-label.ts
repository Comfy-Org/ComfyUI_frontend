import type { ReshootTake } from '@/composables/useReshoot'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

export function takeLabel(take: ReshootTake, locale: Locale): string {
  const { t } = translationsFor(locale)
  if (take.id === 'example') return t('reshoot.take.example')
  if (take.keys > 1)
    return t('reshoot.take.move', { n: take.n, keys: take.keys })
  return t('reshoot.take.static', {
    n: take.n,
    az: take.camera.azimuth,
    el: take.camera.elevation
  })
}
