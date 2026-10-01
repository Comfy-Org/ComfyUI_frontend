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
  height: 900,
  /** Around the plain white can the hand holds. */
  region: { x: 0.3917, y: 0.2756, w: 0.1833, h: 0.4511 } satisfies Rect,
  /** The photo without the can, for the mock to draw a product into. */
  plate: `${DIR}/hand-plate.jpg`,
  /** The hand alone, drawn back over the product so the fingers wrap it. */
  grip: `${DIR}/hand-grip.png`
} as const

export const EXAMPLE_PRODUCTS = [
  {
    id: 'can',
    label: 'swap.product.can',
    url: `${DIR}/product-can.png`,
    name: 'sparkling-can.png',
    width: 240,
    height: 515
  },
  {
    id: 'serum',
    label: 'swap.product.serum',
    url: `${DIR}/product-serum.png`,
    name: 'serum-bottle.png',
    width: 200,
    height: 584
  },
  {
    id: 'tube',
    label: 'swap.product.tube',
    url: `${DIR}/product-tube.png`,
    name: 'hand-cream.png',
    width: 204,
    height: 588
  }
] as const satisfies readonly SwapProduct[]

export const OWN_PRODUCT_ID = 'own'
