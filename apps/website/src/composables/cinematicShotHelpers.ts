import type { CinematicModel } from '../lib/workshop/cinematic-studio/models'
import { ASPECT_RATIOS } from '../lib/workshop/cinematic-studio/catalog'
import type { AspectRatio } from '../lib/workshop/cinematic-studio/catalog'

export function validShotSeed(value: number, bounds: CinematicModel['seed']) {
  if (!bounds || !Number.isFinite(value)) return false
  if (bounds.step !== 'any' && !Number.isInteger(value)) return false
  return seedWithinBounds(value, bounds)
}

function seedWithinBounds(
  value: number,
  bounds: NonNullable<CinematicModel['seed']>
) {
  if (bounds.minimum !== undefined && value < bounds.minimum) return false
  if (bounds.maximum !== undefined && value > bounds.maximum) return false
  return true
}

export function allowedShotAspect(
  value: AspectRatio,
  allowed: readonly string[] | undefined,
  fallback: AspectRatio
): AspectRatio {
  if (!allowed || allowed.includes(value)) return value
  return (
    ASPECT_RATIOS.find((ratio) => allowed.includes(ratio.id))?.id ?? fallback
  )
}

export async function fetchShotImage(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Source unavailable')
  const blob = await response.blob()
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type))
    throw new Error('Unsupported source')
  return blob
}
