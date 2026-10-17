import type { InjectionKey } from 'vue'

export const appTooltipProviderDefaults = {
  delayDuration: 300,
  disableHoverableContent: true,
  ignoreNonKeyboardFocus: true
} as const

export const tooltipOpenOnClickKey: InjectionKey<() => boolean> =
  Symbol('tooltipOpenOnClick')
