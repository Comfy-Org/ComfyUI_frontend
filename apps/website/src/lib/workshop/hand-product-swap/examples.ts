import type { Rect } from '../move-anything/arrange'
import type { HandSwapCopyKey } from './copy'

const DIR = '/images/apps/hand-product-swap'

export interface SwapImage {
  readonly url: string
  readonly name: string
  readonly width: number
  readonly height: number
}

export interface SwapProduct extends SwapImage {
  readonly id: string
  /** The example's name; a visitor's own product goes by its file name. */
  readonly label?: HandSwapCopyKey
}

export const HAND_EXAMPLE = {
  url: `${DIR}/hand.jpg`,
  name: 'hand-holding-can.jpg',
  width: 1200,
  height: 896,
  /** Around the plain white can the hand holds, for the mock to draw into. */
  region: { x: 0.4333, y: 0.279, w: 0.1833, h: 0.4688 } satisfies Rect
} as const

export const EXAMPLE_PRODUCTS = [
  {
    id: 'can',
    label: 'swap.product.can',
    url: `${DIR}/product-can.jpg`,
    name: 'sparkling-can.jpg',
    width: 381,
    height: 640,
    result: `${DIR}/result-can.jpg`
  },
  {
    id: 'serum',
    label: 'swap.product.serum',
    url: `${DIR}/product-serum.jpg`,
    name: 'serum-bottle.jpg',
    width: 228,
    height: 640,
    result: `${DIR}/result-serum.jpg`
  },
  {
    id: 'tube',
    label: 'swap.product.tube',
    url: `${DIR}/product-tube.jpg`,
    name: 'hand-cream.jpg',
    width: 294,
    height: 640,
    result: `${DIR}/result-tube.jpg`
  }
] as const satisfies readonly (SwapProduct & {
  /** The example hand photo holding this product, ready for the mock. */
  readonly result: string
})[]

export const OWN_PRODUCT_ID = 'own'
