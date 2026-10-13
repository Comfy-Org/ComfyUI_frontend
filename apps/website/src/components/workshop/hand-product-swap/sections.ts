import type { Component } from 'vue'

import type {
  HandProductSwap,
  SwapTray
} from '@/composables/useHandProductSwap'
import type { HandSwapCopyKey } from '@/lib/workshop/hand-product-swap/copy'
import HandSwapProducts from './HandSwapProducts.vue'
import HandSwapResolution from './HandSwapResolution.vue'
import HandSwapSeed from './HandSwapSeed.vue'

/** The settings in the bottom composer, each opening as a tray of the same id. */
export const SWAP_SECTIONS = [
  { id: 'product', title: 'swap.product', content: HandSwapProducts },
  { id: 'resolution', title: 'swap.resolution', content: HandSwapResolution },
  { id: 'seed', title: 'swap.seed', content: HandSwapSeed }
] as const satisfies readonly {
  id: SwapTray
  title: HandSwapCopyKey
  content: Component
}[]

/** The current value beside a section's title, so a closed one says it. */
export function sectionMeta(id: SwapTray, swap: HandProductSwap): string {
  const notes = {
    product: () => swap.productName.value,
    resolution: () => swap.resolution.value,
    seed: () => String(swap.seed.value)
  } satisfies Record<SwapTray, () => string>
  return notes[id]()
}
