interface Chromaticities {
  red: readonly [number, number]
  green: readonly [number, number]
  blue: readonly [number, number]
  white: readonly [number, number]
}

const D65: readonly [number, number] = [0.3127, 0.329]

const CHROMATICITIES = {
  sRGB: {
    red: [0.64, 0.33],
    green: [0.3, 0.6],
    blue: [0.15, 0.06],
    white: D65
  },
  'Rec.2020': {
    red: [0.708, 0.292],
    green: [0.17, 0.797],
    blue: [0.131, 0.046],
    white: D65
  }
} satisfies Record<string, Chromaticities>

export type GamutName = keyof typeof CHROMATICITIES

export const GAMUT_NAMES = Object.keys(CHROMATICITIES) as GamutName[]

type Mat3 = readonly number[]

const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]

function rgbToXyz(c: Chromaticities): Mat3 {
  const [rx, ry] = c.red
  const [gx, gy] = c.green
  const [bx, by] = c.blue
  const [wx, wy] = c.white

  const xWhite = wx / wy
  const zWhite = (1 - wx - wy) / wy

  const d = rx * (by - gy) + bx * (gy - ry) + gx * (ry - by)

  const srN =
    xWhite * (by - gy) -
    gx * (by - 1 + by * (xWhite + zWhite)) +
    bx * (gy - 1 + gy * (xWhite + zWhite))
  const sgN =
    xWhite * (ry - by) +
    rx * (by - 1 + by * (xWhite + zWhite)) -
    bx * (ry - 1 + ry * (xWhite + zWhite))
  const sbN =
    xWhite * (gy - ry) -
    rx * (gy - 1 + gy * (xWhite + zWhite)) +
    gx * (ry - 1 + ry * (xWhite + zWhite))

  const sr = srN / d
  const sg = sgN / d
  const sb = sbN / d

  return [
    sr * rx,
    sg * gx,
    sb * bx,
    sr * ry,
    sg * gy,
    sb * by,
    sr * (1 - rx - ry),
    sg * (1 - gx - gy),
    sb * (1 - bx - by)
  ]
}

function multiply(a: Mat3, b: Mat3): Mat3 {
  const result = new Array<number>(9).fill(0)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      let sum = 0
      for (let k = 0; k < 3; k++) sum += a[row * 3 + k] * b[k * 3 + col]
      result[row * 3 + col] = sum
    }
  }
  return result
}

function invert(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
  if (det === 0) return IDENTITY

  const invDet = 1 / det
  return [
    (e * i - f * h) * invDet,
    (c * h - b * i) * invDet,
    (b * f - c * e) * invDet,
    (f * g - d * i) * invDet,
    (a * i - c * g) * invDet,
    (c * d - a * f) * invDet,
    (d * h - e * g) * invDet,
    (b * g - a * h) * invDet,
    (a * e - b * d) * invDet
  ]
}

const SRGB_TO_XYZ = rgbToXyz(CHROMATICITIES.sRGB)
const XYZ_TO_SRGB = invert(SRGB_TO_XYZ)

export function gamutToSrgbMatrix(gamut: GamutName): Mat3 {
  if (gamut === 'sRGB') return IDENTITY
  return multiply(XYZ_TO_SRGB, rgbToXyz(CHROMATICITIES[gamut]))
}

export interface ChromaticityCoords {
  redX: number
  redY: number
  greenX: number
  greenY: number
  blueX: number
  blueY: number
  whiteX: number
  whiteY: number
}

function matchesGamut(c: ChromaticityCoords, gamut: GamutName): boolean {
  const ref = CHROMATICITIES[gamut]
  const tol = 0.01
  return (
    Math.abs(c.redX - ref.red[0]) < tol &&
    Math.abs(c.redY - ref.red[1]) < tol &&
    Math.abs(c.greenX - ref.green[0]) < tol &&
    Math.abs(c.greenY - ref.green[1]) < tol &&
    Math.abs(c.blueX - ref.blue[0]) < tol &&
    Math.abs(c.blueY - ref.blue[1]) < tol &&
    Math.abs(c.whiteX - ref.white[0]) < tol &&
    Math.abs(c.whiteY - ref.white[1]) < tol
  )
}

export function detectGamutFromChromaticities(
  c: ChromaticityCoords | undefined
): GamutName {
  if (!c) return 'sRGB'
  return GAMUT_NAMES.find((name) => matchesGamut(c, name)) ?? 'sRGB'
}
