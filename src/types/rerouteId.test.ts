import { describe, expect, it } from 'vitest'

import { toRerouteId } from '@comfyorg/graph-model/rerouteId'

describe('toRerouteId', () => {
  it('preserves the numeric value', () => {
    expect(toRerouteId(42)).toBe(42)
  })
})
