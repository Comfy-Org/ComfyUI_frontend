import { describe, expect, it } from 'vitest'

import type { DecodedImage } from '@e2e/fixtures/helpers/decodedImage'
import { drawingFound, hookDrawing } from '@e2e/fixtures/helpers/hookDrawing'
import type {
  ClientBox,
  HookDrawing
} from '@e2e/reporters/nodes2Acceptance/layout'

type Rgb = readonly [number, number, number]

const NODE_GREY: Rgb = [53, 53, 53]
const ICON_GREEN: Rgb = [72, 255, 132]

function image(
  width: number,
  height: number,
  fills: { box: ClientBox; rgb: Rgb }[]
): DecodedImage {
  const rgba = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const fill = fills.findLast(
        ({ box }) =>
          x >= box.x &&
          x < box.x + box.width &&
          y >= box.y &&
          y < box.y + box.height
      )
      const [r, g, b] = fill?.rgb ?? [0, 0, 0]
      rgba.set([r, g, b, 255], (y * width + x) * 4)
    }
  return { width, height, rgba }
}

const classicNode: ClientBox = { x: 10, y: 10, width: 200, height: 100 }
const iconAtTopRight = (node: ClientBox): ClientBox => ({
  x: node.x + node.width - 26,
  y: node.y + 4,
  width: 16,
  height: 16
})
const nodeImage = (
  node: ClientBox,
  extra: { box: ClientBox; rgb: Rgb }[] = []
) => image(300, 160, [{ box: node, rgb: NODE_GREY }, ...extra])

const classicDrawing: HookDrawing = {
  pixels: 256,
  distinctPixels: 256,
  colours: [0x4f8],
  box: { x: 174, y: 4, width: 16, height: 16 },
  nodeSize: { width: 200, height: 100 },
  samples: Array.from({ length: 256 }, (_, index) => ({
    x: index % 16,
    y: Math.floor(index / 16),
    colour: 0x4f8
  }))
}

describe('hookDrawing', () => {
  it('measures only what the hooks visibly add, relative to the node', () => {
    expect(
      hookDrawing(
        nodeImage(classicNode, [
          { box: iconAtTopRight(classicNode), rgb: ICON_GREEN }
        ]),
        nodeImage(classicNode),
        classicNode
      )
    ).toMatchObject({
      pixels: 256,
      distinctPixels: 256,
      samples: classicDrawing.samples,
      box: { x: 174, y: 4, width: 16, height: 16 }
    })
  })

  it('finds nothing when the hooks paint in the colour already there', () => {
    expect(
      hookDrawing(
        nodeImage(classicNode, [
          { box: iconAtTopRight(classicNode), rgb: NODE_GREY }
        ]),
        nodeImage(classicNode),
        classicNode
      )
    ).toBeNull()
  })
})

describe('drawingFound', () => {
  const widerNode: ClientBox = { x: 10, y: 10, width: 260, height: 120 }

  it('keeps old colour-only evidence inconclusive', () => {
    expect(
      drawingFound(nodeImage(widerNode), widerNode, {
        ...classicDrawing,
        samples: undefined
      })
    ).toBeNull()
  })

  it.for([
    [
      'finds the drawing at the same corner of a wider node',
      [{ box: iconAtTopRight(widerNode), rgb: ICON_GREEN }],
      256
    ],
    ['finds nothing when the drawing is absent', [], 0]
  ] as const)('%s', ([, extra, expected]) => {
    expect(
      drawingFound(nodeImage(widerNode, [...extra]), widerNode, classicDrawing)
    ).toBe(expected)
  })

  it('does not mistake a nearby patch of the same colour for the drawing', () => {
    const unrelated = { x: 232, y: 30, width: 10, height: 10 }

    expect(
      drawingFound(
        nodeImage(widerNode, [{ box: unrelated, rgb: ICON_GREEN }]),
        widerNode,
        classicDrawing
      )
    ).toBe(0)
  })
})
