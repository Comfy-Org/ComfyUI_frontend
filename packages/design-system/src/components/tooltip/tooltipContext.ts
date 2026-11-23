import type { InjectionKey } from 'vue'

export const tooltipOpenOnClickKey: InjectionKey<() => boolean> =
  Symbol('tooltipOpenOnClick')

export const tooltipSkipDelayKey: InjectionKey<() => number> =
  Symbol('tooltipSkipDelay')
