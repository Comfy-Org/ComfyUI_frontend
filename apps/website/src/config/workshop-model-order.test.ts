import { describe, expect, it } from 'vitest'

import { workshopModelOrderSchema } from './workshop-model-order.schema'

const order: unknown = {
  measuredOn: '2026-09-12',
  windowDays: 30,
  note: 'Order only, no figures.',
  slugs: ['first--generate-images', 'second--generate-images']
}

describe('the stored model order', () => {
  it('refuses a slug listed twice, which would rank that model wrong', () => {
    expect(workshopModelOrderSchema.safeParse(order).success).toBe(true)
    const repeated: unknown = {
      ...(order as Record<string, unknown>),
      slugs: ['first--generate-images', 'first--generate-images']
    }
    const parsed = workshopModelOrderSchema.safeParse(repeated)
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toContain('more than once')
  })
})
