export type TooltipSide = 'top' | 'right' | 'bottom' | 'left'

export interface TooltipConfig {
  value?: string | string[]
  showDelay?: number
  hideDelay?: number
  disabled?: boolean
}

export type TooltipValue = string | string[] | TooltipConfig | undefined
