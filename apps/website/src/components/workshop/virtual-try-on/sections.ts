import type { Component } from 'vue'

import type {
  TryOnTray,
  VirtualTryOn
} from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import type { TryOnCopyKey } from '../../../lib/workshop/virtual-try-on/copy'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import VirtualTryOnFit from './VirtualTryOnFit.vue'
import VirtualTryOnGarments from './VirtualTryOnGarments.vue'
import VirtualTryOnSeed from './VirtualTryOnSeed.vue'

/** Virtual try-on's controls as the bottom composer's chips and trays. */
export const TRY_ON_SECTIONS = [
  { id: 'garment', title: 'tryOn.garment', content: VirtualTryOnGarments },
  { id: 'fit', title: 'tryOn.fit', content: VirtualTryOnFit },
  { id: 'seed', title: 'tryOn.seed', content: VirtualTryOnSeed }
] as const satisfies readonly {
  id: TryOnTray
  title: TryOnCopyKey
  content: Component
}[]

/** The current value beside a control's name, so a closed one says it. */
export function sectionMeta(
  id: TryOnTray,
  tryOn: VirtualTryOn,
  locale: Locale
): string {
  const { setup, garment } = tryOn
  if (id === 'garment')
    return garment.value?.name ?? vc('tryOn.garment.none', locale)
  if (id === 'fit') return vc(`tryOn.fit.${setup.value.fit}`, locale)
  return String(setup.value.seed)
}

/** The one-line summary of the whole setup, for the collapsed phone sheet. */
export function setupSummary(tryOn: VirtualTryOn, locale: Locale): string {
  const { garment, setup } = tryOn
  return garment.value
    ? vc('tryOn.summary', locale, {
        garment: garment.value.name,
        fit: vc(`tryOn.fit.${setup.value.fit}`, locale)
      })
    : vc('tryOn.summary.empty', locale)
}
