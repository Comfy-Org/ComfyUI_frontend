import type { CinematicModel } from './models'

export function acceptsSeed(
  seed: number | undefined,
  descriptor: CinematicModel['seed']
): boolean {
  if (seed === undefined) return true
  if (!descriptor || !Number.isFinite(seed)) return false
  if (descriptor.step !== 'any' && !Number.isInteger(seed)) return false
  if (descriptor.minimum !== undefined && seed < descriptor.minimum)
    return false
  return descriptor.maximum === undefined || seed <= descriptor.maximum
}
