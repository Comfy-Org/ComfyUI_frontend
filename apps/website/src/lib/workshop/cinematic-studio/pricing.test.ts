import { describe, expect, it } from 'vitest'

import { getRouterWorkshopModelDetail } from '../../../config/workshop-router-content'
import { priceKey, shotEstimate } from './estimate'
import { runnableCinematicModels } from './models'
import { priceCinematicModels } from './pricing'

const models = await priceCinematicModels(
  runnableCinematicModels(getRouterWorkshopModelDetail),
  getRouterWorkshopModelDetail
)
const prices = (slug: string) =>
  models.find((model) => model.slug === slug)?.prices

const FLUX = 'bfl--flux-2-pro--generate-images'
const SEEDREAM = 'byteplus--seedream-4-5--generate-images'

describe('priceCinematicModels', () => {
  it.for([
    'vertexai--gemini-3-pro-image--generate-images',
    'krea--krea-2-large--generate-images',
    'qwen--qwen-image-3.0-pro-text-to-image--generate-images'
  ])('leaves %s without an estimate', (slug) => {
    expect(models.some((model) => model.slug === slug)).toBe(true)
    expect(prices(slug)).toBeUndefined()
  })

  it('prices Flux 2 Pro by the frame the Router is asked for', () => {
    const square = (resolution: '1K' | '2K') =>
      prices(FLUX)?.[priceKey('1:1', resolution, 0)]
    expect(square('1K')?.min).toBeCloseTo(6.33)
    expect(square('2K')?.min).toBeCloseTo(15.825)
  })

  it('widens Flux 2 Pro to its reference-image range', () => {
    const plain = prices(FLUX)?.[priceKey('1:1', '1K', 0)]
    const referenced = prices(FLUX)?.[priceKey('1:1', '1K', 1)]
    expect(referenced?.min).toBeGreaterThan(plain?.min ?? Infinity)
    expect(referenced?.max).toBeGreaterThan(referenced?.min ?? Infinity)
  })

  it('prices every Seedream 4.5 format, with and without references', () => {
    expect(Object.keys(prices(SEEDREAM) ?? {})).toHaveLength(30)
  })
})

describe('shotEstimate', () => {
  it('multiplies the per-take price by the takes', () => {
    const shot = { aspect: '1:1', resolution: '2K', references: 0 } as const
    const one = shotEstimate(prices(FLUX), { ...shot, takes: 1 })
    const four = shotEstimate(prices(FLUX), { ...shot, takes: 4 })
    expect(four?.total.min).toBeCloseTo((one?.total.min ?? 0) * 4)
  })
})
