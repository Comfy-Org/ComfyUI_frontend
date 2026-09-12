import { describe, expect, it } from 'vitest'

import { workshopModelOrderSchema } from './workshop-model-order.schema'

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
