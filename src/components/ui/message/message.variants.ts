import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const messageVariants = cva({
  base: 'flex w-full items-start gap-2 rounded-lg border px-3 py-2.75 text-sm',
  variants: {
    severity: {
      error:
        'border-destructive-background/40 bg-destructive-background/10 text-base-foreground',
      warn: 'border-warning-background/50 bg-warning-background/15 text-base-foreground',
      info: 'border-primary-background/40 bg-primary-background/10 text-base-foreground',
      success:
        'border-success-background/50 bg-success-background/15 text-base-foreground',
      secondary:
        'border-border-subtle bg-secondary-background text-base-foreground'
    }
  },
  defaultVariants: { severity: 'info' }
})

export type MessageVariants = VariantProps<typeof messageVariants>
