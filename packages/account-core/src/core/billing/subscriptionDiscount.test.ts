import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'

import { SubscriptionDiscountSchema } from './subscriptionDiscount.js'

const TERMS = [
  'this_payment',
  'first_month',
  'first_year',
  'months',
  'ongoing'
] as const

expectTypeOf<
  z.infer<typeof SubscriptionDiscountSchema>['term']
>().toEqualTypeOf<(typeof TERMS)[number] | undefined>()

const discount = (term?: unknown) => ({
  kind: 'promotion',
  code: 'SAVE20',
  ...(term === undefined ? {} : { term })
})

describe('SubscriptionDiscountSchema term', () => {
  it.for(TERMS)('reads the server-reported term %s', (term) => {
    expect(SubscriptionDiscountSchema.parse(discount(term)).term).toBe(term)
  })

  it('leaves the term out when the server does not know it', () => {
    expect(SubscriptionDiscountSchema.parse(discount())).not.toHaveProperty(
      'term'
    )
  })

  it('rejects a term outside the spec', () => {
    expect(
      SubscriptionDiscountSchema.safeParse(discount('first_week')).success
    ).toBe(false)
  })
})
