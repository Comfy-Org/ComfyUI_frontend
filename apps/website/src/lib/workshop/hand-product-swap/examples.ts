import type { Rect } from './placement'
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

const hand = (id: string, name: string, region: Rect) => ({
  url: `${DIR}/examples/${id}.jpg`,
  name,
  width: 1200,
  height: 905,
  region
})

/** The hand photos offered to start from, each with where its plain item sits. */
export const HAND_EXAMPLES = [
  { id: 'can', image: HAND_EXAMPLE },
  {
    id: 'bottle',
    image: hand('bottle', 'hand-holding-bottle.jpg', {
      x: 0.35,
      y: 0.12,
      w: 0.31,
      h: 0.76
    })
  },
  {
    id: 'jar',
    image: hand('jar', 'hand-holding-jar.jpg', {
      x: 0.33,
      y: 0.28,
      w: 0.33,
      h: 0.38
    })
  },
  {
    id: 'box',
    image: hand('box', 'hand-holding-box.jpg', {
      x: 0.33,
      y: 0.26,
      w: 0.36,
      h: 0.51
    })
  }
] as const

/** Where the plain item sits in an example hand photo, if it is one. */
export function exampleRegion(url: string): Rect | undefined {
  return HAND_EXAMPLES.find(({ image }) => image.url === url)?.image.region
}

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
