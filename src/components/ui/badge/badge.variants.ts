import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const badgeVariants = cva({
  base: 'inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap font-medium',
  variants: {
    variant: {
      tag: 'min-h-5 rounded-md px-1.5 py-0.5 text-xs',
      chip: 'min-h-7 rounded-full px-2 py-1 text-sm',
      badge: 'min-h-5 min-w-5 rounded-full px-1.5 text-xs',
      dot: 'size-2 rounded-full p-0'
    },
    severity: {
      primary: 'bg-primary-background text-base-foreground',
      secondary: 'bg-secondary-background text-base-foreground',
      danger: 'bg-destructive-background text-white',
      info: 'bg-primary-background/20 text-base-foreground',
      success: 'bg-success-background text-white',
      warn: 'bg-warning-background text-warning-on-background',
      warning: 'bg-warning-background text-warning-on-background'
    }
  },
  defaultVariants: { variant: 'tag', severity: 'secondary' }
})

export type BadgeVariants = VariantProps<typeof badgeVariants>
