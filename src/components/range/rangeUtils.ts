import type { RangeValue } from '@/lib/litegraph/src/types/widgets'

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

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
  const clamped = Math.max(0.001, Math.min(0.999, position))
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

export function constrainRange(value: RangeValue): RangeValue {
  const min = clamp01(value.min)
  const max = clamp01(Math.max(min, value.max))
  const midpoint =
    value.midpoint !== undefined ? clamp01(value.midpoint) : undefined
  return { min, max, midpoint }
}
