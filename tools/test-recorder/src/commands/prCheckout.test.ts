import { describe, expect, it } from 'vitest'

import { decidePrCheckout } from './prCheckout'

describe('decidePrCheckout', () => {
  it.for([
    ['feature', 'feature', false, 'already-on-branch'],
    ['feature', 'feature', true, 'already-on-branch'],
    ['main', 'feature', true, 'refuse-dirty'],
    ['main', 'feature', false, 'offer-switch']
  ] as const)(
    'returns %s / %s / dirty=%s as %s',
    ([current, target, dirty, expected]) => {
      expect(decidePrCheckout(current, target, dirty)).toBe(expected)
    }
  )
})
