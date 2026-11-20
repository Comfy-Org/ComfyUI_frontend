import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { GraphOverlayHitRegion } from '@/platform/nodeApi/v4/types'
import {
  isFiniteNumber,
  isList,
  packObject
} from '@/platform/nodeApi/v4/utilities/packArguments'

const HIT_REGION_FIELDS = {
  kind: true,
  x: true,
  y: true,
  radius: true,
  width: true,
  height: true
} satisfies Record<
  | keyof Extract<GraphOverlayHitRegion, { kind: 'circle' }>
  | keyof Extract<GraphOverlayHitRegion, { kind: 'rect' }>,
  true
>

interface ViewportPoint {
  readonly x: number
  readonly y: number
}

/** The regions a pack passed, checked and frozen. */
export function readHitRegions(
  member: string,
  regions: unknown
): readonly GraphOverlayHitRegion[] {
  if (!isList(regions)) {
    throw invalidArgument(member, 'a list of hit regions', regions)
  }
  return Object.freeze(
    Array.from(regions, (region, index) =>
      readRegion(member, region, `regions[${index}]`)
    )
  )
}

function readRegion(
  member: string,
  region: unknown,
  path: string
): GraphOverlayHitRegion {
  const fields = packObject(member, path, region, HIT_REGION_FIELDS, `${path}.`)
  const kind = fields.required('kind', isKind, "'circle' or 'rect'")
  const x = fields.required('x', isFiniteNumber, 'a finite number')
  const y = fields.required('y', isFiniteNumber, 'a finite number')
  const size = (key: 'radius' | 'width' | 'height') =>
    fields.required(key, isPositive, 'a positive finite number')
  return Object.freeze(
    kind === 'circle'
      ? { kind, x, y, radius: size('radius') }
      : { kind, x, y, width: size('width'), height: size('height') }
  )
}

/** True if `point` is in a region; every point is when the pack set no regions. */
export function hitsRegion(
  regions: readonly GraphOverlayHitRegion[] | undefined,
  point: ViewportPoint
): boolean {
  if (!regions) return true
  return regions.some((region) =>
    region.kind === 'circle'
      ? Math.hypot(point.x - region.x, point.y - region.y) <= region.radius
      : point.x >= region.x &&
        point.x <= region.x + region.width &&
        point.y >= region.y &&
        point.y <= region.y + region.height
  )
}

function isKind(value: unknown): value is GraphOverlayHitRegion['kind'] {
  return value === 'circle' || value === 'rect'
}

function isPositive(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0
}
