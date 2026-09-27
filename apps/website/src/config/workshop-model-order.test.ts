import { describe, expect, it } from 'vitest'

import { workshopModelOrderSchema } from './workshop-model-order.schema'
import display from '../content/workshop-display.json'
import { modelOrderRank } from './workshop-model-order'

const order: unknown = {
  measuredOn: '2026-09-12',
  windowDays: 30,
  note: 'Order only, no figures.',
  slugs: ['first--generate-images', 'second--generate-images']
}

describe('the stored model order', () => {
  it('takes a well-formed file', () => {
    expect(workshopModelOrderSchema.safeParse(order).success).toBe(true)
  })

  it('refuses a slug listed twice, which would rank that model wrong', () => {
    const repeated: unknown = {
      measuredOn: '2026-09-12',
      windowDays: 30,
      note: 'Order only, no figures.',
      slugs: ['first--generate-images', 'first--generate-images']
    }
    const parsed = workshopModelOrderSchema.safeParse(repeated)
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toContain('more than once')
  })

  it('names only pages in the content catalogue', () => {
    const known = new Set(display.map((entry) => entry.slug))
    expect(
      [...modelOrderRank.keys()].filter((slug) => !known.has(slug))
    ).toEqual([])
  })

  it('ranks each reviewed model and role page independently', () => {
    const reviewedRolePages = [
      'byteplus--seedance-2-5-edit-video--edit-videos',
      'byteplus--seedance-2-5-first-last-frame--animate-images',
      'byteplus--seedance-2-5-reference--generate-videos',
      'byteplus--seedance-2-5-text-to-video--generate-videos',
      'byteplus--seedance-2-image-to-video--animate-images',
      'byteplus--seedance-2-reference--generate-videos',
      'byteplus--seedance-2-text-to-video--generate-videos',
      'freepik--magnific-skin-enhancer--edit-images',
      'freepik--magnific-upscaler-precise-v2--edit-images',
      'kling--omni-pro-edit-video--edit-videos',
      'kling--omni-pro-first-last-frame--animate-images',
      'kling--omni-pro-image-to-video--animate-images',
      'kling--omni-pro-text-to-video--generate-videos',
      'kling--omni-pro-video-to-video--edit-videos',
      'ltx--text-to-video-v2--generate-videos',
      'openai--gpt-image-2--edit-images',
      'openai--gpt-image-2--generate-images',
      'openai--gpt-image-2.5-flare--edit-images',
      'openai--gpt-image-2.5-flare--generate-images',
      'openai--gpt-image-2.5-sunburst--edit-images',
      'openai--gpt-image-2.5-sunburst--generate-images',
      'wan--text-to-video-3.0--generate-videos',
      'wan--text-to-video-3.0-prime--generate-videos',
      'xai--grok-imagine-image-2.0--generate-images'
    ]

    expect(
      reviewedRolePages.filter((slug) => !modelOrderRank.has(slug))
    ).toEqual([])
    expect(
      new Set(reviewedRolePages.map((slug) => modelOrderRank.get(slug))).size
    ).toBe(reviewedRolePages.length)
  })

  it('keeps missing audited pages in place so published pages compact around them', () => {
    const imageEditors = [
      'vertexai--gemini-nano-banana-2--edit-images',
      'vertexai--gemini-3-pro-image--edit-images',
      'byteplus--seedream-5-pro--edit-images',
      'xai--grok-imagine-image-edit--edit-images',
      'openai--gpt-image-2--edit-images',
      'xai--grok-imagine-image-2.0-edit--edit-images'
    ]

    const firstRank = modelOrderRank.get(imageEditors[0])
    expect(firstRank).toBeTypeOf('number')
    expect(imageEditors.map((slug) => modelOrderRank.get(slug))).toEqual(
      [...imageEditors.keys()].map((offset) => (firstRank ?? -1) + offset)
    )
  })

  it.for([[], [''], ['   ']])('refuses an empty order: %j', (slugs) => {
    expect(
      workshopModelOrderSchema.safeParse({
        measuredOn: '2026-09-12',
        windowDays: 30,
        note: 'Order only, no figures.',
        slugs
      }).success
    ).toBe(false)
  })

  it.for<unknown>([
    {
      measuredOn: '2026-09-12',
      windowDays: 30,
      note: 'Order only, no figures.',
      slugs: 'first--generate-images'
    },
    {
      measuredOn: '2026-09-12',
      windowDays: 30,
      note: 'Order only, no figures.',
      slugs: [{ slug: 'first--generate-images' }]
    },
    {
      measuredOn: '2026-09-12',
      windowDays: 0,
      note: 'Order only, no figures.',
      slugs: []
    },
    {
      measuredOn: 'not-a-date',
      windowDays: 30,
      note: 'Order only, no figures.',
      slugs: []
    },
    { slugs: [] }
  ])('refuses a file of the wrong shape: %#', (malformed) => {
    expect(workshopModelOrderSchema.safeParse(malformed).success).toBe(false)
  })
})
