import type { InjectionKey } from 'vue'

export const OnCloseKey: InjectionKey<() => void> = Symbol()
