import type { InjectionKey } from 'vue'

export const tooltipOpenOnClickKey: InjectionKey<() => boolean> =
  Symbol('tooltipOpenOnClick')
