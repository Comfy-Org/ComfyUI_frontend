import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const tooltipVariants = cva({
  base: 'z-50 select-none border border-node-component-tooltip-border bg-node-component-tooltip-surface px-4 py-2 text-node-component-tooltip shadow-none',
  variants: {
    size: {
      small: 'rounded-lg text-xs',
      large: 'max-w-75 rounded-sm text-sm/tight font-normal'
    }
  },
  defaultVariants: {
    size: 'small'
  }
})

export type TooltipVariants = VariantProps<typeof tooltipVariants>
