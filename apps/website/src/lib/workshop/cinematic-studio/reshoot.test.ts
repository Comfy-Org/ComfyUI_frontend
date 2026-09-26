import { describe, expect, it } from 'vitest'

import type { ReshootZone } from './reshoot'
import {
  DEFAULT_CAMERA,
  cameraZone,
  clampAxis,
  clipFits,
  withKey
} from './reshoot'

describe('cameraZone', () => {
  it.for<[number, number, ReshootZone]>([
    [-30, 15, 'green'],
    [50, 0, 'yellow'],
    [0, -15, 'yellow'],
    [80, 0, 'red'],
    [0, -25, 'red']
  ])(
    'rates azimuth %i° and elevation %i° as %s',
    ([azimuth, elevation, zone]) => {
      expect(cameraZone({ ...DEFAULT_CAMERA, azimuth, elevation })).toBe(zone)
    }
  )
})

describe('clampAxis', () => {
  it('keeps a value inside the axis range', () => {
    expect(clampAxis('azimuth', 120)).toBe(90)
    expect(clampAxis('distance', 0)).toBe(0.1)
  })
})

describe('withKey', () => {
  it('replaces a key on the same frame and keeps keys in frame order', () => {
    const early = { frame: 10, camera: DEFAULT_CAMERA }
    const late = { frame: 40, camera: DEFAULT_CAMERA }
    const moved = { frame: 10, camera: { ...DEFAULT_CAMERA, azimuth: 20 } }

    expect(withKey(withKey([late], early), moved)).toEqual([moved, late])
  })
})

describe('clipFits', () => {
  it.for<[number, boolean]>([
    [4.9, false],
    [5, true],
    [15, true],
    [15.1, false]
  ])('accepts a %f second clip: %s', ([seconds, fits]) => {
    expect(clipFits(seconds)).toBe(fits)
  })
})
