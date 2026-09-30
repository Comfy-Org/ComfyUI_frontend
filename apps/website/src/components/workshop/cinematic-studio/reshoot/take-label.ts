import type { ReshootTake } from '../../../../composables/useReshoot'
import { studioT as rc } from '../../../../lib/workshop/cinematic-studio/copy'
import type { Locale } from '../../../../i18n/translations'

export function takeLabel(take: ReshootTake, locale: Locale): string {
  if (take.id === 'example')
    return rc('reshoot.take.example', {}, { locale: locale })
  if (take.keys > 1)
    return rc(
      'reshoot.take.move',
      { n: take.n, keys: take.keys },
      { locale: locale }
    )
  return rc(
    'reshoot.take.static',
    {
      n: take.n,
      az: take.camera.azimuth,
      el: take.camera.elevation
    },
    { locale: locale }
  )
}
