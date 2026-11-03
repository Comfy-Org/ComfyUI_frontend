import { describe, expect, it } from 'vitest'

import { toLinkId } from '@comfyorg/graph-model/linkId'

describe('toLinkId', () => {
  it('preserves the numeric value', () => {
    expect(toLinkId(42)).toBe(42)
  })
})
