import { toRerouteId } from '@comfyorg/graph-model/rerouteId'
import { describe, expect, it } from 'vitest'

describe('toRerouteId', () => {
  it('preserves the numeric value', () => {
    expect(toRerouteId(42)).toBe(42)
  })
})
