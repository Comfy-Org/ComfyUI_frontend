import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const messageVariants = cva({
  base: 'flex w-full items-start gap-2 rounded-lg border px-3 py-2.75 text-sm',
  variants: {
    severity: {
      error: 'border-destructive/40 bg-destructive/10 text-foreground',
      warning:
        'border-warning-background/50 bg-warning-background/15 text-foreground',
      info: 'border-primary/40 bg-primary/10 text-foreground',
      success:
        'border-success-background/50 bg-success-background/15 text-foreground',
      secondary: 'border-border-subtle bg-secondary text-foreground'
    }
  },
  defaultVariants: { severity: 'info' }
})

export type MessageVariants = VariantProps<typeof messageVariants>
