export interface Point {
  x: number
  y: number
}

export interface Artwork {
  id: 'anime' | 'dragon' | 'robot' | 'spacecraft'
  pixel: (x: number, y: number) => number
}

export function inEllipse(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number
) {
  const normalizedX = (x - centerX) / radiusX
  const normalizedY = (y - centerY) / radiusY
  return normalizedX * normalizedX + normalizedY * normalizedY <= 1
}

function triangleArea(a: Point, b: Point, c: Point) {
  return Math.abs(
    (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2
  )
}

export function inTriangle(x: number, y: number, a: Point, b: Point, c: Point) {
  const point = { x, y }
  const area = triangleArea(a, b, c)
  const subAreas =
    triangleArea(point, b, c) +
    triangleArea(a, point, c) +
    triangleArea(a, b, point)

  return Math.abs(area - subAreas) < 0.001
}

function animePixel(x: number, y: number) {
  const outerHair = inEllipse(x, y, 0, -0.08, 0.46, 0.72)
  const face = inEllipse(x, y, 0, -0.01, 0.32, 0.52)
  const leftEye = inEllipse(x, y, -0.13, -0.05, 0.055, 0.07)
  const rightEye = inEllipse(x, y, 0.13, -0.05, 0.055, 0.07)
  const mouth = Math.abs(x) < 0.1 && y > 0.18 && y < 0.25
  const fringe = outerHair && y < -0.12 + Math.sin((x + 0.42) * 17) * 0.08
  const shoulders =
    y > 0.42 && y < 0.92 && Math.abs(x) < 0.7 - (y - 0.42) * 0.26
  const leftHairPoint = inTriangle(
    x,
    y,
    { x: -0.38, y: -0.5 },
    { x: -0.14, y: -0.92 },
    { x: -0.04, y: -0.58 }
  )
  const rightHairPoint = inTriangle(
    x,
    y,
    { x: 0.04, y: -0.58 },
    { x: 0.16, y: -0.92 },
    { x: 0.4, y: -0.5 }
  )

  if (leftEye || rightEye || mouth) return 0
  if (fringe || leftHairPoint || rightHairPoint) return 0.66
  if (face) return 0.94
  if (outerHair) return 0.58
  if (shoulders) return 0.52
  return 0
}

function dragonPixel(x: number, y: number) {
  const bodyLine = 0.12 + Math.sin((x + 0.55) * 4.2) * 0.12
  const body = x > -0.68 && x < 0.62 && Math.abs(y - bodyLine) < 0.11
  const head = inEllipse(x, y, 0.62, -0.04, 0.2, 0.2)
  const snout = x > 0.62 && x < 0.9 && y > -0.05 && y < 0.11
  const eye = inEllipse(x, y, 0.68, -0.09, 0.04, 0.05)
  const leftWing = inTriangle(
    x,
    y,
    { x: -0.26, y: 0.08 },
    { x: -0.58, y: -0.78 },
    { x: 0.02, y: -0.22 }
  )
  const rightWing = inTriangle(
    x,
    y,
    { x: 0.02, y: 0.04 },
    { x: 0.42, y: -0.76 },
    { x: 0.42, y: -0.08 }
  )
  const tail =
    x < -0.5 && x > -0.92 && Math.abs(y - (-0.15 - (x + 0.5) * 1.2)) < 0.08
  const legs =
    ((x > -0.2 && x < -0.08) || (x > 0.22 && x < 0.34)) && y > 0.16 && y < 0.55

  if (eye) return 0
  if (head || snout) return 1
  if (body || tail || legs) return 0.86
  if (leftWing || rightWing) return 0.58
  return 0
}

function robotPixel(x: number, y: number) {
  const head = Math.abs(x) < 0.48 && y > -0.58 && y < 0.3
  const cornerCut = Math.abs(x) > 0.38 && (y < -0.48 || y > 0.2)
  const leftEye = inEllipse(x, y, -0.18, -0.18, 0.09, 0.11)
  const rightEye = inEllipse(x, y, 0.18, -0.18, 0.09, 0.11)
  const mouth = Math.abs(x) < 0.25 && y > 0.08 && y < 0.15
  const antenna = Math.abs(x) < 0.045 && y > -0.82 && y < -0.56
  const antennaTip = inEllipse(x, y, 0, -0.84, 0.08, 0.08)
  const ears = Math.abs(x) > 0.46 && Math.abs(x) < 0.62 && y > -0.3 && y < 0.06
  const torso = y > 0.36 && y < 0.92 && Math.abs(x) < 0.66 - (y - 0.36) * 0.18

  if (leftEye || rightEye || mouth || antennaTip) return 1
  if (antenna || ears) return 0.82
  if (head && !cornerCut) return 0.52
  if (torso) return 0.64
  return 0
}

function spacecraftPixel(x: number, y: number) {
  const fuselage =
    x > -0.62 && x < 0.62 && Math.abs(y) < 0.09 + (x + 0.62) * 0.04
  const nose = inTriangle(
    x,
    y,
    { x: 0.52, y: -0.18 },
    { x: 0.92, y: 0 },
    { x: 0.52, y: 0.18 }
  )
  const upperWing = inTriangle(
    x,
    y,
    { x: -0.24, y: -0.06 },
    { x: 0.24, y: -0.72 },
    { x: 0.38, y: -0.08 }
  )
  const lowerWing = inTriangle(
    x,
    y,
    { x: -0.24, y: 0.06 },
    { x: 0.24, y: 0.72 },
    { x: 0.38, y: 0.08 }
  )
  const cockpit = inEllipse(x, y, 0.34, -0.01, 0.14, 0.1)
  const upperEngine = inEllipse(x, y, -0.66, -0.17, 0.17, 0.11)
  const lowerEngine = inEllipse(x, y, -0.66, 0.17, 0.17, 0.11)

  if (cockpit) return 1
  if (fuselage || nose) return 0.88
  if (upperWing || lowerWing) return 0.62
  if (upperEngine || lowerEngine) return 0.74
  return 0
}

export const ARTWORKS: readonly Artwork[] = [
  { id: 'anime', pixel: animePixel },
  { id: 'dragon', pixel: dragonPixel },
  { id: 'robot', pixel: robotPixel },
  { id: 'spacecraft', pixel: spacecraftPixel }
]
