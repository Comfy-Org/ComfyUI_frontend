import { describe, expect, it } from 'vitest'

import { toRerouteId } from '@/types/rerouteId'

describe('toRerouteId', () => {
  it('preserves the numeric value', () => {
    expect(toRerouteId(42)).toBe(42)
  })
})
