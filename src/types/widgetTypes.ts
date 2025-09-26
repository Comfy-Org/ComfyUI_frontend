import type { InjectionKey } from 'vue'

export type MediaKind = 'image' | 'video' | 'audio' | 'model' | 'unknown'

export const OnCloseKey: InjectionKey<() => void> = Symbol()
