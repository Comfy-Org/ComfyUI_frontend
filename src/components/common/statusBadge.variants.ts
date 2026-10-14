import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const statusBadgeVariants = cva({
  base: 'inline-flex items-center justify-center rounded-full',
  variants: {
    severity: {
      default: 'bg-primary text-foreground',
      secondary: 'bg-secondary text-foreground',
      warn: 'bg-warning-background text-background',
      danger: 'bg-destructive text-white',
      contrast: 'bg-foreground text-background'
    },
    variant: {
      label: 'h-3.5 px-1 text-3xs font-semibold uppercase',
      dot: 'size-2',
      circle: 'size-3.5 text-3xs font-semibold'
    }
  },
  defaultVariants: {
    severity: 'default',
    variant: 'label'
  }
})

export type StatusBadgeVariants = VariantProps<typeof statusBadgeVariants>
