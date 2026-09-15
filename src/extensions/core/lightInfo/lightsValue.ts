import {
  LIGHT_TYPES,
  createDefaultLight,
  type LightInfoEntry,
  type LightInfoType,
  type Vec3
} from './types'

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

function normalizeLight(value: unknown): LightInfoEntry | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  if (!isLightType(raw.type)) return null
  const defaults = createDefaultLight(raw.type)
  const light: LightInfoEntry = {
    type: raw.type,
    color:
      typeof raw.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(raw.color)
        ? raw.color
        : defaults.color,
    intensity: Math.max(0, toFinite(raw.intensity, defaults.intensity)),
    position: toVec3(raw.position, defaults.position)
  }
  if (raw.type !== 'point') {
    light.target = toVec3(raw.target, defaults.target ?? { x: 0, y: 0, z: 0 })
  }
  if (raw.type !== 'directional') {
    const range = toFinite(raw.range, 0)
    if (range > 0) light.range = range
  }
  if (raw.type === 'spot') {
    const outer = toFinite(raw.outerConeAngle, defaults.outerConeAngle ?? 45)
    light.innerConeAngle = Math.min(
      toFinite(raw.innerConeAngle, defaults.innerConeAngle ?? 30),
      outer
    )
    light.outerConeAngle = outer
  }
  const radius = Math.max(0, toFinite(raw.radius, defaults.radius ?? 0))
  if (radius > 0) light.radius = radius
  if (raw.castShadow === false) light.castShadow = false
  return light
}

export function normalizeLightsValue(value: unknown): LightInfoEntry[] {
  if (!Array.isArray(value)) return []
  return value
    .map(normalizeLight)
    .filter((light): light is LightInfoEntry => light !== null)
}
