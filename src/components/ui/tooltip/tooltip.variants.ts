import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const tooltipVariants = cva({
  base: 'z-50 select-none',
  variants: {
    variant: {
      default: 'rounded-md bg-[#3f3f46] px-3 py-2 text-sm text-white shadow-sm',
      small:
        'rounded-lg border border-node-component-tooltip-border bg-node-component-tooltip-surface px-4 py-2 text-xs text-node-component-tooltip shadow-none',
      large:
        'max-w-75 rounded-sm border border-node-component-tooltip-border bg-node-component-tooltip-surface px-4 py-2 text-sm/tight font-normal text-node-component-tooltip shadow-none'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
})

export type TooltipVariants = VariantProps<typeof tooltipVariants>
