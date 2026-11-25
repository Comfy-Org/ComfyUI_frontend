import { describe, expect, it } from 'vitest'

import { BILLING_ACTION_NAME, planCtaActionName } from './billingActionNames'

describe('billing RUM action names', () => {
  const names = [
    ...Object.values(BILLING_ACTION_NAME),
    planCtaActionName('standard'),
    planCtaActionName('creator'),
    planCtaActionName('pro')
  ]

  it('keeps every billing CTA under the prefix the frustration monitor matches', () => {
    expect(names.every((name) => name.startsWith('billing.'))).toBe(true)
  })

  it('gives every billing CTA its own name', () => {
    expect(new Set(names).size).toBe(names.length)
  })
})
