import { describe, expect, it } from 'vitest'

import {
  supportsInAppCancellation,
  usesLegacyAccountOperations
} from './billingRail'

describe('billingRail', () => {
  it.for([
    ['legacy_stripe', true],
    ['stripe', false],
    ['metronome', false],
    [null, false],
    [undefined, false]
  ] as const)('usesLegacyAccountOperations(%s) is %s', ([rail, expected]) => {
    expect(usesLegacyAccountOperations(rail)).toBe(expected)
  })

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
    expect(usesLegacyAccountOperations('new_rail')).toBe(false)
    // @ts-expect-error simulates a new backend rail value
    expect(supportsInAppCancellation('new_rail')).toBe(false)
  })
})
