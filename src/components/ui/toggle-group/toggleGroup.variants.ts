import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const toggleGroupVariants = cva({
  base: 'flex items-center justify-center gap-1',
  variants: {
    variant: {
      default: 'bg-transparent',
      outline: 'bg-transparent'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
})

export const toggleGroupItemVariants = cva({
  base: 'inline-flex items-center justify-center rounded text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-interface-menu-component-surface-selected data-[state=on]:text-text-primary',
  variants: {
    variant: {
      default:
        'bg-transparent hover:bg-interface-menu-component-surface-selected/50 text-text-secondary',
      outline:
        'border border-border-default bg-transparent hover:bg-secondary-background text-text-secondary'
    },
    size: {
      default: 'h-7 px-3',
      sm: 'h-6 px-2 text-xs',
      lg: 'h-9 px-4'
    }
  },
  defaultVariants: {
    variant: 'default',
    size: 'default'
  }
})

export type ToggleGroupVariants = VariantProps<typeof toggleGroupVariants>
export type ToggleGroupItemVariants = VariantProps<typeof toggleGroupItemVariants>
