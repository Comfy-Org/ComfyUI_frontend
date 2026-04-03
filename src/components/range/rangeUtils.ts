import { clamp } from 'es-toolkit'

import type { RangeValue } from '@/lib/litegraph/src/types/widgets'

export { clamp }

export function normalize(value: number, min: number, max: number): number {
  return max === min ? 0 : (value - min) / (max - min)
}

export function denormalize(
  normalized: number,
  min: number,
  max: number
): number {
  return min + normalized * (max - min)
}

export function positionToGamma(position: number): number {
  const clamped = clamp(position, 0.001, 0.999)
  return -Math.log2(clamped)
}

export function gammaToPosition(gamma: number): number {
  return Math.pow(2, -gamma)
}

export function formatMidpointLabel(
  position: number,
  scale: 'linear' | 'gamma'
): string {
  if (scale === 'gamma') {
    return positionToGamma(position).toFixed(2)
  }
  return position.toFixed(2)
}

export function constrainRange(
  value: RangeValue,
  valueMin: number = 0,
  valueMax: number = 1
): RangeValue {
  const min = clamp(value.min, valueMin, valueMax)
  const max = clamp(Math.max(min, value.max), valueMin, valueMax)
  const midpoint =
    value.midpoint !== undefined ? clamp(value.midpoint, 0, 1) : undefined
  return { min, max, midpoint }
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
