import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const tagVariants = cva({
  base: 'inline-flex h-6 shrink-0 items-center justify-center gap-1 text-xs',
  variants: {
    shape: {
      square:
        'rounded-sm bg-modal-card-tag-background text-modal-card-tag-foreground',
      rounded:
        'rounded-full bg-secondary-background text-modal-card-tag-foreground'
    },
    removable: {
      true: 'py-1 pr-1 pl-2',
      false: 'px-2 py-1'
    }
  },
  defaultVariants: {
    shape: 'square',
    removable: false
  }
})

export type TagVariants = VariantProps<typeof tagVariants>
