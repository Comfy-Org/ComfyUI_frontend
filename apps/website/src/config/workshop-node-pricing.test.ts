import { describe, expect, it } from 'vitest'

import { estimateWorkshopNodePrice } from './workshop-node-pricing'
import { workshopNodePricingSchema } from './workshop-node-pricing.schema'
import pricing from '../data/workshop-node-pricing.json'

describe('node-based Models price estimates', () => {
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
