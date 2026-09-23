import { describe, expect, it } from 'vitest'

import {
  GAMUT_NAMES,
  detectGamutFromChromaticities,
  gamutToSrgbMatrix
} from './colorGamut'

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1]

describe('gamutToSrgbMatrix', () => {
  it('returns identity for sRGB source', () => {
    expect(gamutToSrgbMatrix('sRGB')).toEqual(IDENTITY)
  })

  it('matches the published linear Rec.2020 to sRGB matrix', () => {
    const expected = [
      1.6605, -0.5876, -0.0728, -0.1246, 1.1329, -0.0083, -0.0182, -0.1006,
      1.1187
    ]
    const actual = gamutToSrgbMatrix('Rec.2020')
    for (let i = 0; i < 9; i++) {
      expect(actual[i]).toBeCloseTo(expected[i], 3)
    }
  })

  it('maps the Rec.2020 white point to equal-energy sRGB (rows sum to ~1)', () => {
    const m = gamutToSrgbMatrix('Rec.2020')
    for (let row = 0; row < 3; row++) {
      const sum = m[row * 3] + m[row * 3 + 1] + m[row * 3 + 2]
      expect(sum).toBeCloseTo(1, 3)
    }
  })

  it('exposes the supported gamut names', () => {
    expect(GAMUT_NAMES).toContain('sRGB')
    expect(GAMUT_NAMES).toContain('Rec.2020')
  })
})

describe('detectGamutFromChromaticities', () => {
  it('falls back to sRGB when the attribute is absent', () => {
    expect(detectGamutFromChromaticities(undefined)).toBe('sRGB')
  })

  it('detects Rec.2020 primaries from the EXR header', () => {
    expect(
      detectGamutFromChromaticities({
        redX: 0.708,
        redY: 0.292,
        greenX: 0.17,
        greenY: 0.797,
        blueX: 0.131,
        blueY: 0.046,
        whiteX: 0.3127,
        whiteY: 0.329
      })
    ).toBe('Rec.2020')
  })

  it('does not match Rec.2020 when the white point differs', () => {
    expect(
      detectGamutFromChromaticities({
        redX: 0.708,
        redY: 0.292,
        greenX: 0.17,
        greenY: 0.797,
        blueX: 0.131,
        blueY: 0.046,
        whiteX: 0.314,
        whiteY: 0.351
      })
    ).toBe('sRGB')
  })

  it('detects Rec.709/sRGB primaries from the EXR header', () => {
    expect(
      detectGamutFromChromaticities({
        redX: 0.64,
        redY: 0.33,
        greenX: 0.3,
        greenY: 0.6,
        blueX: 0.15,
        blueY: 0.06,
        whiteX: 0.3127,
        whiteY: 0.329
      })
    ).toBe('sRGB')
  })
})
