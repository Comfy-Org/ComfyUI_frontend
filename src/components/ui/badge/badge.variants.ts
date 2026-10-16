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
      label: 'h-3.5 rounded-full px-1 text-3xs font-semibold uppercase',
      circle: 'size-3.5 rounded-full text-3xs font-semibold',
      outline: 'rounded-sm border bg-transparent px-1.5 py-0.5 text-2xs',
      square: 'rounded-sm px-1.5 py-0.5 text-xs',
      pill: 'rounded-full px-2 py-0.5 text-2xs',
      dot: 'size-2 rounded-full p-0'
    },
    severity: {
      default: 'bg-primary text-foreground',
      contrast: 'bg-foreground text-background',
      primary: 'bg-primary/10 text-foreground',
      secondary: 'bg-secondary text-foreground',
      muted: 'bg-muted text-muted-foreground',
      danger: 'bg-destructive text-foreground',
      info: 'bg-primary/20 text-foreground',
      success: 'bg-success/15 text-foreground',
      warning: 'bg-warning text-warning-foreground'
    }
  },
  defaultVariants: { variant: 'tag', severity: 'secondary' }
})

export type BadgeVariants = VariantProps<typeof badgeVariants>
