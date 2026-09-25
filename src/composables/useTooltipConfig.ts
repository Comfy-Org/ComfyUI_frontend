import type { TooltipConfig } from '@/components/ui/tooltip'

export const buildTooltipConfig = (value: string): TooltipConfig => ({
  value,
  showDelay: 300,
  hideDelay: 0,
  contentClass: 'px-2 py-1 text-xs leading-none shadow-none'
})
