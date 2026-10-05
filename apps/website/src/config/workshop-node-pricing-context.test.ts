import { describe, expect, it } from 'vitest'

import {
  pricingContext,
  referenceImages
} from './workshop-node-pricing-context'

const rule = {
  priceBadge: {
    engine: 'jsonata' as const,
    depends_on: {
      widgets: [
        { name: 'model', type: 'COMBO' },
        { name: 'model.width', type: 'INT' },
        { name: 'model.height', type: 'INT' }
      ],
      inputs: ['image'],
      input_groups: ['model.images']
    },
    expr: '0'
  },
  widgets: { model: 'Flux.2 [pro]', 'model.width': 1024, 'model.height': 768 }
}

describe('referenceImages', () => {
  it.for([
    ['generate-images', {}, 0],
    ['edit-images', {}, 1],
    ['animate-images', {}, 1],
    ['generate-images', { images: 2 }, 2],
    ['edit-images', { images: 0 }, 0]
  ] as const)('counts %s with %o as %i', ([useCase, settings, expected]) => {
    expect(referenceImages(useCase, settings)).toBe(expected)
  })
})

describe('pricingContext', () => {
  it('keeps the node defaults when the run names no size', () => {
    expect(pricingContext(rule, {}, 0)).toEqual({
      widgets: {
        model: 'flux.2 [pro]',
        'model.width': 1024,
        'model.height': 768
      },
      inputs: { image: { connected: false } },
      inputGroups: { 'model.images': 0 }
    })
  })

  it('prices the size and references the run asks for', () => {
    expect(pricingContext(rule, { width: 2048, height: 878 }, 2)).toMatchObject(
      {
        widgets: { 'model.width': 2048, 'model.height': 878 },
        inputs: { image: { connected: true } },
        inputGroups: { 'model.images': 2 }
      }
    )
  })

  it('has no context when a dependency has no usable value', () => {
    expect(
      pricingContext(
        { ...rule, widgets: { ...rule.widgets, 'model.width': 'wide' } },
        {},
        0
      )
    ).toBeUndefined()
  })
})
