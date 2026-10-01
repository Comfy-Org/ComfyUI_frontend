import type { Component } from 'vue'

import type {
  HandProductSwap,
  SwapTray
} from '../../../composables/useHandProductSwap'
import type { Locale } from '../../../i18n/translations'
import type { HandSwapCopyKey } from '../../../lib/workshop/hand-product-swap/copy'
import { hc } from '../../../lib/workshop/hand-product-swap/copy'
import HandSwapAdvanced from './HandSwapAdvanced.vue'
import HandSwapProducts from './HandSwapProducts.vue'
import HandSwapResolution from './HandSwapResolution.vue'

/**
 * The settings in panel order. In the side panel each is a collapsible
 * section; in the bottom composer each opens as a tray of the same id.
 */
export const SWAP_SECTIONS = [
  {
    id: 'product',
    title: 'swap.product',
    content: HandSwapProducts,
    open: true
  },
  {
    id: 'resolution',
    title: 'swap.resolution',
    content: HandSwapResolution,
    open: true
  },
  {
    id: 'advanced',
    title: 'swap.advanced',
    content: HandSwapAdvanced,
    open: false
  }
] as const satisfies readonly {
  id: SwapTray
  title: HandSwapCopyKey
  content: Component
  open: boolean
}[]

/** The current value beside a section's title, so a closed one says it. */
export function sectionMeta(
  id: SwapTray,
  swap: HandProductSwap,
  locale: Locale
): string {
  const notes = {
    product: () => swap.productName.value,
    resolution: () => swap.resolution.value,
    advanced: () => hc('swap.advanced.summary', locale, { n: swap.seed.value })
  } satisfies Record<SwapTray, () => string>
  return notes[id]()
}
