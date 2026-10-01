import type { Component } from 'vue'

import type {
  TryOnTray,
  VirtualTryOn
} from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import type { TryOnCopyKey } from '../../../lib/workshop/virtual-try-on/copy'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import VirtualTryOnAdvanced from './VirtualTryOnAdvanced.vue'
import VirtualTryOnFit from './VirtualTryOnFit.vue'
import VirtualTryOnGarments from './VirtualTryOnGarments.vue'

/**
 * Virtual try-on's controls in panel order. In the side panel each is a
 * collapsible section; in the bottom composer each opens as a tray.
 */
export const TRY_ON_SECTIONS = [
  {
    id: 'garment',
    title: 'tryOn.garment',
    content: VirtualTryOnGarments,
    open: true
  },
  { id: 'fit', title: 'tryOn.fit', content: VirtualTryOnFit, open: true },
  {
    id: 'advanced',
    title: 'tryOn.advanced',
    content: VirtualTryOnAdvanced,
    open: false
  }
] as const satisfies readonly {
  id: TryOnTray
  title: TryOnCopyKey
  content: Component
  open: boolean
}[]

/** The current value beside a section's title, so a closed one says it. */
export function sectionMeta(
  id: TryOnTray,
  tryOn: VirtualTryOn,
  locale: Locale
): string {
  const { setup, garment } = tryOn
  if (id === 'garment')
    return garment.value?.name ?? vc('tryOn.garment.none', locale)
  if (id === 'fit') return vc(`tryOn.fit.${setup.value.fit}`, locale)
  return vc('tryOn.advanced.summary', locale, { n: setup.value.seed })
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
