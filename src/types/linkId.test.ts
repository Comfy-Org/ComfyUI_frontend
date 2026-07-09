import { describe, expect, it } from 'vitest'

import { toLinkId } from '@/types/linkId'

describe('toLinkId', () => {
  it('preserves the numeric value', () => {
    expect(toLinkId(42)).toBe(42)
  })
})
