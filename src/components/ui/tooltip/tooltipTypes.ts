export type TooltipSide = 'top' | 'right' | 'bottom' | 'left'

export interface TooltipConfig {
  value?: string | string[] | null
  showDelay?: number
  hideDelay?: number
  disabled?: boolean
}

export type TooltipValue = string | string[] | TooltipConfig | null | undefined
