import type { PointTuple as CurvePoint } from '@comfyorg/shared-frontend-utils/geometry'

export type { PointTuple as CurvePoint } from '@comfyorg/shared-frontend-utils/geometry'

export const CURVE_INTERPOLATIONS = ['monotone_cubic', 'linear'] as const

export type CurveInterpolation = (typeof CURVE_INTERPOLATIONS)[number]

export interface CurveData {
  points: CurvePoint[]
  interpolation: CurveInterpolation
}
