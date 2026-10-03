import { clamp } from 'es-toolkit'

import { LIGHT_TYPES, createDefaultLight } from './types'
import type { LightInfoEntry, LightInfoType, Vec3 } from './types'

const MIN_OUTER_CONE_ANGLE = 1
const MAX_CONE_ANGLE = 90

function isLightType(value: unknown): value is LightInfoType {
  return (
    typeof value === 'string' &&
    (LIGHT_TYPES as readonly string[]).includes(value)
  )
}

function toVec3(value: unknown, fallback: Vec3): Vec3 {
  const v = value as Partial<Vec3> | null | undefined
  const num = (n: unknown, d: number) =>
    typeof n === 'number' && Number.isFinite(n) ? n : d
  return {
    x: num(v?.x, fallback.x),
    y: num(v?.y, fallback.y),
    z: num(v?.z, fallback.z)
  }
}

function toFinite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function toColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value : fallback
}

function coneAngles(
  raw: Record<string, unknown>,
  defaults: LightInfoEntry
): Pick<LightInfoEntry, 'innerConeAngle' | 'outerConeAngle'> {
  const outer = clamp(
    toFinite(raw.outerConeAngle, defaults.outerConeAngle ?? 45),
    MIN_OUTER_CONE_ANGLE,
    MAX_CONE_ANGLE
  )
  const inner = clamp(
    toFinite(raw.innerConeAngle, defaults.innerConeAngle ?? 30),
    0,
    outer
  )
  return { innerConeAngle: inner, outerConeAngle: outer }
}

function typeSpecificFields(
  raw: Record<string, unknown>,
  defaults: LightInfoEntry
): Partial<LightInfoEntry> {
  const range = toFinite(raw.range, 0)
  return {
    ...(defaults.type !== 'point' && {
      target: toVec3(raw.target, defaults.target ?? { x: 0, y: 0, z: 0 })
    }),
    ...(defaults.type !== 'directional' && range > 0 && { range }),
    ...(defaults.type === 'spot' && coneAngles(raw, defaults))
  }
}

function normalizeLight(value: unknown): LightInfoEntry | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  if (!isLightType(raw.type)) return null
  const defaults = createDefaultLight(raw.type)
  return {
    type: raw.type,
    color: toColor(raw.color, defaults.color),
    intensity: Math.max(0, toFinite(raw.intensity, defaults.intensity)),
    position: toVec3(raw.position, defaults.position),
    ...typeSpecificFields(raw, defaults),
    radius: Math.max(0, toFinite(raw.radius, defaults.radius ?? 0)),
    ...(raw.castShadow === false && { castShadow: false })
  }
}

export function normalizeLightsValue(value: unknown): LightInfoEntry[] {
  if (!Array.isArray(value)) return []
  return value
    .map(normalizeLight)
    .filter((light): light is LightInfoEntry => light !== null)
}
