import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const cardVariants = cva({
  base: 'border border-border-default',
  variants: {
    surface: {
      background: 'overflow-hidden rounded-2xl bg-base-background',
      secondary: 'rounded-lg bg-secondary-background'
    }
  },
  defaultVariants: { surface: 'background' }
})

export type CardVariants = VariantProps<typeof cardVariants>
