import { toLinkId } from '@comfyorg/graph-model/linkId'
import { describe, expect, it } from 'vitest'

describe('toLinkId', () => {
  it('preserves the numeric value', () => {
    expect(toLinkId(42)).toBe(42)
  })
})
