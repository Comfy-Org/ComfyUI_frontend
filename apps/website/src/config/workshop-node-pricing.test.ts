import { describe, expect, it } from 'vitest'

import {
  estimateWorkshopNodePrice,
  estimateWorkshopRunCredits
} from './workshop-node-pricing'
import { workshopNodePricingSchema } from './workshop-node-pricing.schema'
import pricing from '../data/workshop-node-pricing.json'

describe('node-based Models price estimates', () => {
  it.for([
    ['bfl/flux-kontext-pro', 'edit-images', '8.44 credits/Run'],
    ['bria/image-edit-gen-fill', 'edit-images', '9.05 credits/Run'],
    ['luma/photon-flash-1', 'generate-images', '0.57 credits/Run'],
    ['runway/gen4_image', 'generate-images', '24.14 credits/Run'],
    ['wan/wan2.5-i2i-preview', 'edit-images', '6.33 credits/Run'],
    ['wavespeed/seedvr2', 'edit-images', '2.11 credits/Run']
  ] as const)(
    'uses the published flat rate for %s',
    async ([routerId, useCase, expected]) => {
      expect(await estimateWorkshopNodePrice({ routerId }, useCase)).toBe(
        expected
      )
    }
  )

  it('does not reuse a published rate for another operation', async () => {
    expect(
      await estimateWorkshopNodePrice(
        { routerId: 'bfl/flux-kontext-pro' },
        'generate-videos'
      )
    ).toBeUndefined()
  })
  it('uses the Seedream 4.5 node formula and preserves the image-count unit', async () => {
    expect(
      await estimateWorkshopNodePrice(
        { routerId: 'byteplus/seedream-4-5-251128' },
        'generate-images'
      )
    ).toBe('~8.4 credits x images/Run')
  })

  it('uses the chosen Flux model and preserves the reference-image range', async () => {
    expect(
      await estimateWorkshopNodePrice(
        { routerId: 'bfl/flux-2-pro' },
        'generate-images'
      )
    ).toBe('6.3 credits/Run')
    expect(
      await estimateWorkshopNodePrice(
        { routerId: 'bfl/flux-2-max' },
        'generate-images'
      )
    ).toBe('14.8 credits/Run')
    expect(
      await estimateWorkshopNodePrice(
        { routerId: 'bfl/flux-2-max' },
        'edit-images'
      )
    ).toBe('~21.1-65.4 credits/Run')
  })

  it('does not reuse a generation-only rule for another operation', async () => {
    expect(
      await estimateWorkshopNodePrice(
        { routerId: 'xai/grok-imagine-image' },
        'edit-images'
      )
    ).toBeUndefined()
  })

  it('leaves unverified models without a numeric estimate', async () => {
    expect(
      await estimateWorkshopNodePrice(
        { routerId: 'unknown/model' },
        'generate-images'
      )
    ).toBeUndefined()
  })

  it('prices the selected operation, not every capability of a dual-purpose model', async () => {
    const model = {
      routerId: 'xai/grok-imagine-video',
      useCases: ['generate-videos', 'animate-images']
    }
    const textPrice = await estimateWorkshopNodePrice(model, 'generate-videos')
    const imagePrice = await estimateWorkshopNodePrice(model, 'animate-images')
    expect(textPrice).toBeDefined()
    expect(imagePrice).toBeDefined()
    expect(textPrice).not.toBe(imagePrice)
    expect(await estimateWorkshopNodePrice(model, undefined)).toBeUndefined()
  })

  it('prices the size a run asks for instead of the node default', async () => {
    expect(
      await estimateWorkshopNodePrice(
        { routerId: 'bfl/flux-2-pro' },
        'generate-images',
        { width: 2048, height: 2048 }
      )
    ).toBe('15.8 credits/Run')
  })
})

describe('node-based Models run credits', () => {
  const FLUX = { routerId: 'bfl/flux-2-pro' }

  it.for([
    ['a 1 MP Flux 2 Pro frame', FLUX, { width: 1024, height: 1024 }, 6.33],
    ['a 4 MP Flux 2 Pro frame', FLUX, { width: 2048, height: 2048 }, 15.825],
    [
      'a Seedream 4.5 image at any size',
      { routerId: 'byteplus/seedream-4-5-251128' },
      { width: 3136, height: 1344 },
      8.44
    ],
    ['a published flat rate', { routerId: 'bfl/flux-kontext-pro' }, {}, 8.44]
  ] as const)('prices %s', async ([, model, settings, credits]) => {
    const estimate = await estimateWorkshopRunCredits(
      model,
      'generate-images',
      settings
    )
    expect(estimate?.min).toBeCloseTo(credits)
    expect(estimate?.max).toBeCloseTo(credits)
  })

  it('widens to the declared range once reference images are sent', async () => {
    const estimate = await estimateWorkshopRunCredits(FLUX, 'generate-images', {
      width: 1024,
      height: 1024,
      images: 2
    })
    expect(estimate?.min).toBeCloseTo(9.495)
    expect(estimate?.max).toBeCloseTo(31.65)
  })

  it('has no estimate for a model without a verified price', async () => {
    expect(
      await estimateWorkshopRunCredits(
        { routerId: 'vertexai/gemini-3-pro-image' },
        'generate-images'
      )
    ).toBeUndefined()
  })
})

describe('node pricing snapshot', () => {
  it('rejects a snapshot missing a declared pricing dependency', () => {
    const row = pricing.find((entry) => entry.routerId === 'bfl/flux-2-max')
    if (!row) throw new Error('Missing Flux pricing fixture')
    const result = workshopNodePricingSchema.safeParse([
      { ...row, widgets: {} }
    ])
    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected validation failure')
    expect(result.error.issues.map((issue) => issue.path)).toContainEqual([
      0,
      'widgets',
      'model.width'
    ])
  })

  it('rejects ambiguous duplicate bindings', () => {
    const [row] = pricing
    const result = workshopNodePricingSchema.safeParse([row, row])
    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected validation failure')
    expect(result.error.issues.map((issue) => issue.message)).toContain(
      'Duplicate Router pricing binding'
    )
  })
})
