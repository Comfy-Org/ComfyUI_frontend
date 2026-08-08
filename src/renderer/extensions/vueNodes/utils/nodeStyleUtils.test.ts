import { RenderShape } from '@/lib/litegraph/src/types/globalEnums'
import { shapeVariantClass } from '@/renderer/extensions/vueNodes/utils/nodeStyleUtils'
import { describe, expect, it } from 'vitest'

describe('shapeVariantClass', () => {
  const variants = {
    box: 'box-class',
    card: 'card-class',
    default: 'default-class'
  }

  it('returns the box variant for RenderShape.BOX', () => {
    expect(shapeVariantClass(RenderShape.BOX, variants)).toBe('box-class')
  })

  it('returns the card variant for RenderShape.CARD', () => {
    expect(shapeVariantClass(RenderShape.CARD, variants)).toBe('card-class')
  })

  it('returns the default variant for any other shape', () => {
    expect(shapeVariantClass(RenderShape.CIRCLE, variants)).toBe(
      'default-class'
    )
  })

  it('returns the default variant when shape is undefined', () => {
    expect(shapeVariantClass(undefined, variants)).toBe('default-class')
  })
})
