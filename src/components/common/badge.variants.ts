import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const badgeVariants = cva({
  base: 'inline-flex items-center justify-center rounded-full',
  variants: {
    severity: {
      default: 'bg-primary-background text-white',
      secondary: 'bg-secondary-background-hover text-white',
      warn: 'bg-warning-background text-white',
      danger: 'bg-destructive-background text-white',
      contrast: 'bg-base-foreground text-base-background'
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

export type BadgeVariants = VariantProps<typeof badgeVariants>
