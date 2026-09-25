import type { TooltipConfig } from '@/components/ui/tooltip'

export const TOOLTIP_TEXT_CLASS =
  'border-node-component-tooltip-border bg-node-component-tooltip-surface text-node-component-tooltip border rounded-md px-2 py-1 text-xs leading-none shadow-none'

export const buildTooltipConfig = (value: string): TooltipConfig => ({
  value,
  showDelay: 300,
  hideDelay: 0,
  contentClass: 'px-2 py-1 text-xs leading-none shadow-none'
})
