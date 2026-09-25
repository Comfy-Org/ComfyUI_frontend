import type { CinematicModel } from './models'

export type SeedBehavior = 'random' | 'fixed' | 'increment' | 'decrement'

export function nextSeed(
  value: number,
  behavior: SeedBehavior,
  bounds: NonNullable<CinematicModel['seed']>
): number {
  const minimum = Math.max(0, bounds.minimum ?? 0)
  const maximum = Math.min(
    Number.MAX_SAFE_INTEGER,
    bounds.maximum ?? Number.MAX_SAFE_INTEGER
  )
  if (behavior === 'increment')
    return value >= maximum ? minimum : Math.min(maximum, value + 1)
  if (behavior === 'decrement')
    return value <= minimum ? maximum : Math.max(minimum, value - 1)
  return value
}
