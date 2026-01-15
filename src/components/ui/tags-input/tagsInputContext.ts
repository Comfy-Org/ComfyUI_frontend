import type { InjectionKey } from 'vue'

export type FocusCallback = (() => void) | undefined

export const tagsInputFocusKey: InjectionKey<
  (callback: FocusCallback) => void
> = Symbol('tagsInputFocus')
