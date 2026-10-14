import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const badgeVariants = cva({
  base: 'inline-flex shrink-0 items-center justify-center gap-1 font-medium whitespace-nowrap',
  variants: {
    variant: {
      tag: 'rounded-md px-2 py-1 text-sm font-bold',
      chip: 'min-h-7 rounded-full px-2 py-1 text-sm',
      badge: 'min-h-5 min-w-5 rounded-full px-1.5 text-xs',
      compact: 'h-5 rounded-full px-2 py-0.5 text-xs normal-case',
      dot: 'size-2 rounded-full p-0'
    },
    severity: {
      primary: 'bg-primary/10 text-foreground',
      secondary: 'bg-secondary text-foreground',
      danger: 'bg-destructive text-foreground',
      info: 'bg-primary/20 text-foreground',
      success: 'bg-success-background/15 text-foreground',
      warning: 'bg-warning-background text-warning-on-background'
    }
  },
  defaultVariants: { variant: 'tag', severity: 'secondary' }
})

export type BadgeVariants = VariantProps<typeof badgeVariants>
