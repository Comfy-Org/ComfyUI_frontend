export type LightInfoType = 'directional' | 'point' | 'spot'

export interface LightInfoVec3 {
  x: number
  y: number
  z: number
}

export interface LightInfoEntry {
  type: LightInfoType
  color: string
  intensity: number
  position: LightInfoVec3
  target?: LightInfoVec3
  range?: number
  innerConeAngle?: number
  outerConeAngle?: number
  radius?: number
  castShadow?: boolean
}
