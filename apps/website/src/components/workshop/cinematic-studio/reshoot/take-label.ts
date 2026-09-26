import type { ReshootTake } from '../../../../composables/useReshootDemo'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'

export function takeLabel(take: ReshootTake, locale: Locale): string {
  if (take.id === 'example') return rc('reshoot.take.example', locale)
  if (take.keys > 1)
    return rc('reshoot.take.move', locale)
      .replace('{n}', String(take.n))
      .replace('{keys}', String(take.keys))
  return rc('reshoot.take.static', locale)
    .replace('{n}', String(take.n))
    .replace('{az}', String(take.camera.azimuth))
    .replace('{el}', String(take.camera.elevation))
}
