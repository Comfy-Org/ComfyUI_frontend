import type { Resolution } from './resolution'

/** Seconds a model can generate; `min` is absent when only the ceiling is known. */
export interface DurationRange {
  readonly min?: number
  readonly max: number
}

/** "480p – 4K" from resolutions listed highest first, or the single one. */
export function resolutionRange(
  resolutions: readonly Resolution[] = []
): string | undefined {
  const highest = resolutions.at(0)
  const lowest = resolutions.at(-1)
  if (!highest || !lowest) return undefined
  return highest === lowest ? highest : `${lowest} – ${highest}`
}

const SECONDS = /^(\d+(?:\.\d+)?)s?$/

function positiveSeconds(value: unknown): number[] {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(SECONDS.exec(value.trim())?.[1])
        : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? [parsed] : []
}

interface Bounds {
  readonly lower: number[]
  readonly upper: number[]
}

function boundsOf(node: unknown): Bounds {
  if (!node || typeof node !== 'object') return { lower: [], upper: [] }
  const children = Array.isArray(node) ? node : Object.values(node)
  const nested = children.map(boundsOf)
  const listed =
    'enum' in node && Array.isArray(node.enum)
      ? node.enum.flatMap(positiveSeconds)
      : []
  const minimum = 'minimum' in node ? positiveSeconds(node.minimum) : []
  const maximum = 'maximum' in node ? positiveSeconds(node.maximum) : []
  return {
    lower: [...listed, ...minimum, ...nested.flatMap((bound) => bound.lower)],
    upper: [...listed, ...maximum, ...nested.flatMap((bound) => bound.upper)]
  }
}

function durationNodes(node: unknown): unknown[] {
  if (!node || typeof node !== 'object') return []
  const entries = Array.isArray(node)
    ? node.map((child): [string, unknown] => ['', child])
    : Object.entries(node)
  return entries.flatMap(([key, child]) =>
    key === 'duration' ? [child] : durationNodes(child)
  )
}

/**
 * The clip lengths a Router input schema offers for `duration`, from its
 * enum, minimum and maximum. Sentinels such as -1 (let the model choose) are
 * not lengths and are left out.
 */
export function durationsIn(schema: unknown): DurationRange | undefined {
  const bounds = durationNodes(schema).map(boundsOf)
  const lower = bounds.flatMap((bound) => bound.lower)
  const upper = bounds.flatMap((bound) => bound.upper)
  if (!upper.length) return undefined
  const max = Math.max(...upper)
  return lower.length ? { min: Math.min(...lower), max } : { max }
}
