export type CurvePoint = [x: number, y: number]

export const CURVE_INTERPOLATIONS = ['monotone_cubic', 'linear'] as const

export type CurveInterpolation = (typeof CURVE_INTERPOLATIONS)[number]

export interface CurveData {
  points: CurvePoint[]
  interpolation: CurveInterpolation
}
