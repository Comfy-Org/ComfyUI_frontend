import { describe, expect, it } from 'vitest'

import { supportsInAppCancellation } from './billingRail'

describe('billingRail', () => {
  it.for([
    ['stripe', true],
    ['legacy_stripe', false],
    ['metronome', false],
    [null, false],
    [undefined, false]
  ] as const)('supportsInAppCancellation(%s) is %s', ([rail, expected]) => {
    expect(supportsInAppCancellation(rail)).toBe(expected)
  })

  it('treats an unrecognised rail value as unsupported', () => {
    // @ts-expect-error simulates a new backend rail value
    expect(supportsInAppCancellation('new_rail')).toBe(false)
  })
})
