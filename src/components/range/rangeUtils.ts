import { clamp } from 'es-toolkit'

import type { RangeValue } from '@/lib/litegraph/src/types/widgets'

export function positionToGamma(position: number): number {
  // Avoid log2(0) = -Infinity and log2(1) = 0 (division by zero in gamma)
  const clamped = clamp(position, 0.001, 0.999)
  return -Math.log2(clamped)
}

export function gammaToPosition(gamma: number): number {
  return Math.pow(2, -gamma)
}

export function isRangeValue(value: unknown): value is RangeValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false
  const v = value as Record<string, unknown>
  const hasFiniteBounds = Number.isFinite(v.min) && Number.isFinite(v.max)
  const hasValidMidpoint =
    v.midpoint === undefined || Number.isFinite(v.midpoint)
  return hasFiniteBounds && hasValidMidpoint
}
