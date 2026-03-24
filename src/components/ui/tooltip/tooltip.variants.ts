import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const tooltipVariants = cva({
  base: 'z-50 select-none border border-node-component-tooltip-border bg-node-component-tooltip-surface px-4 py-2 text-node-component-tooltip shadow-interface',
  variants: {
    size: {
      small: 'rounded-lg text-xs leading-none',
      large: 'max-w-75 rounded-sm text-sm/tight font-normal'
    }
  },
  defaultVariants: {
    size: 'small'
  }
})

export type TooltipVariants = VariantProps<typeof tooltipVariants>

const sizes = ['small', 'large'] as const satisfies Array<
  TooltipVariants['size']
>
const sides = ['top', 'bottom', 'left', 'right'] as const

export const FOR_STORIES = { sizes, sides } as const
