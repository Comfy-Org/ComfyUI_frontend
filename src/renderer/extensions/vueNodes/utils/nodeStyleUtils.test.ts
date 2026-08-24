import { RenderShape } from '@/lib/litegraph/src/types/globalEnums'
import { shapeVariantClass } from '@/renderer/extensions/vueNodes/utils/nodeStyleUtils'
import { describe, expect, it } from 'vitest'

describe('shapeVariantClass', () => {
  const variants = {
    box: 'box-class',
    card: 'card-class',
    default: 'default-class'
  } as const

  it.for([
    ['RenderShape.BOX', RenderShape.BOX, 'box-class'],
    ['RenderShape.CARD', RenderShape.CARD, 'card-class'],
    ['any other shape', RenderShape.CIRCLE, 'default-class'],
    ['undefined shape', undefined, 'default-class']
  ] as const)('returns the variant class for %s', ([, shape, expected]) => {
    expect(shapeVariantClass(shape, variants)).toBe(expected)
  })
})
