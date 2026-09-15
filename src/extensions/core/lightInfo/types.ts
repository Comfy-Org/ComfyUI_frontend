import type {
  LightInfoEntry,
  LightInfoType,
  LightInfoVec3
} from '@/types/lightInfo'

export type { LightInfoEntry, LightInfoType }
export type Vec3 = LightInfoVec3

export const LIGHT_TYPES: readonly LightInfoType[] = [
  'directional',
  'point',
  'spot'
]

export function createDefaultLight(type: LightInfoType): LightInfoEntry {
  if (type === 'point') {
    return {
      type,
      color: '#ffffff',
      intensity: 25,
      position: { x: 1.2, y: 2, z: 1.2 },
      radius: 0.1
    }
  }
  if (type === 'spot') {
    return {
      type,
      color: '#ffffff',
      intensity: 25,
      position: { x: 1.2, y: 2, z: 1.2 },
      target: { x: 0, y: 0, z: 0 },
      innerConeAngle: 30,
      outerConeAngle: 45,
      radius: 0.1
    }
  }
  return {
    type: 'directional',
    color: '#ffffff',
    intensity: 1.5,
    position: { x: 0, y: 1.8, z: 1.8 },
    target: { x: 0, y: 0, z: 0 },
    radius: 0.5
  }
}

function cloneLight(light: LightInfoEntry): LightInfoEntry {
  return {
    ...light,
    position: { ...light.position },
    ...(light.target ? { target: { ...light.target } } : {})
  }
}

export function cloneLights(lights: LightInfoEntry[]): LightInfoEntry[] {
  return lights.map(cloneLight)
}

export function lightTarget(light: LightInfoEntry): Vec3 {
  return light.target ?? { x: 0, y: 0, z: 0 }
}
