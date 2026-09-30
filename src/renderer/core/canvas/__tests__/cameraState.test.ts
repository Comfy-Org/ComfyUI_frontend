import { describe, expect, it } from 'vitest'

import { normalizeCameraState } from '@/renderer/core/canvas/cameraState'

describe('normalizeCameraState', () => {
  it.for([
    { name: 'missing state', value: undefined },
    { name: 'zero scale', value: { offset: [0, 0], scale: 0 } },
    { name: 'negative scale', value: { offset: [0, 0], scale: -1 } },
    { name: 'non-finite scale', value: { offset: [0, 0], scale: Infinity } },
    { name: 'non-finite x', value: { offset: [NaN, 0], scale: 1 } },
    { name: 'non-finite y', value: { offset: [0, null], scale: 1 } }
  ])('rejects $name', ({ value }) => {
    expect(normalizeCameraState(value)).toBeNull()
  })

  it('accepts finite offsets and a positive scale', () => {
    expect(normalizeCameraState({ offset: [-120, 42], scale: 0.5 })).toEqual({
      offset: [-120, 42],
      scale: 0.5
    })
  })

  it.for([
    { savedScale: 5e-324, expectedScale: 0.01 },
    { savedScale: 5, expectedScale: 4 }
  ])(
    'clamps saved scale $savedScale to the active canvas range',
    ({ savedScale, expectedScale }) => {
      const state = { offset: [-120, 42], scale: savedScale }

      expect(
        normalizeCameraState(state, { minScale: 0.01, maxScale: 4 })
      ).toEqual({ offset: [-120, 42], scale: expectedScale })
    }
  )
})
