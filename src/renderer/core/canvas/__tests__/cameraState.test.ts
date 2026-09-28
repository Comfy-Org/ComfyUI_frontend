import { describe, expect, it } from 'vitest'

import { isValidCameraState } from '@/renderer/core/canvas/cameraState'

describe('isValidCameraState', () => {
  it.for([
    { name: 'missing state', value: undefined },
    { name: 'zero scale', value: { offset: [0, 0], scale: 0 } },
    { name: 'negative scale', value: { offset: [0, 0], scale: -1 } },
    { name: 'non-finite scale', value: { offset: [0, 0], scale: Infinity } },
    { name: 'non-finite x', value: { offset: [NaN, 0], scale: 1 } },
    { name: 'non-finite y', value: { offset: [0, null], scale: 1 } }
  ])('rejects $name', ({ value }) => {
    expect(isValidCameraState(value)).toBe(false)
  })

  it('accepts finite offsets and a positive scale', () => {
    expect(isValidCameraState({ offset: [-120, 42], scale: 0.5 })).toBe(true)
  })
})
