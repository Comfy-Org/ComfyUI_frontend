import type { InjectionKey, Ref } from 'vue'

export interface TooltipContext {
  open: Ref<boolean>
  triggerEl: Ref<HTMLElement | null>
  delayDuration: number
  scheduleOpen: () => void
  close: () => void
}

export const TOOLTIP_KEY: InjectionKey<TooltipContext> = Symbol('tooltip')
