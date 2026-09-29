import type { ReshootTake } from '../../../../composables/useReshootDemo'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'

export function takeLabel(take: ReshootTake, locale: Locale): string {
  if (take.id === 'example') return rc('reshoot.take.example', locale)
  if (take.keys > 1)
    return rc('reshoot.take.move', locale, { n: take.n, keys: take.keys })
  return rc('reshoot.take.static', locale, {
    n: take.n,
    az: take.camera.azimuth,
    el: take.camera.elevation
  })
}
