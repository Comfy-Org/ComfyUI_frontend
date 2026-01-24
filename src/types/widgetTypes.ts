import type { InjectionKey } from 'vue'

export type AssetKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'model'
  | 'mesh'
  | 'unknown'

export const OnCloseKey: InjectionKey<() => void> = Symbol()
