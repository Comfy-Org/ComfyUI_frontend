import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const cardVariants = cva({
  base: 'border',
  variants: {
    surface: {
      background: 'overflow-hidden rounded-2xl bg-background',
      secondary: 'rounded-lg bg-secondary'
    }
  },
  defaultVariants: { surface: 'background' }
})

export type CardVariants = VariantProps<typeof cardVariants>
