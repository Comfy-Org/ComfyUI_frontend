import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

/**
 * The developer platform's button: 8px corners, a 12px medium label and the
 * three control heights, with the lightest smoke as the only filled accent.
 */
export const adminButtonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-fg disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        primary: 'bg-admin-fg text-admin-card hover:bg-smoke-300',
        secondary:
          'border border-admin-field text-admin-fg hover:border-ash-800 hover:bg-admin-hover',
        ghost: 'text-admin-muted hover:bg-admin-hover hover:text-admin-fg',
        danger: 'bg-admin-danger text-admin-fg hover:bg-admin-danger/90',
        dangerGhost: 'text-admin-danger-text hover:bg-admin-danger/12'
      },
      size: {
        sm: 'h-6 px-2 text-xs',
        md: 'h-8 px-3 text-xs',
        lg: 'h-10 px-4 text-sm',
        icon: 'size-8'
      }
    },
    defaultVariants: { variant: 'secondary', size: 'md' }
  }
)

export type AdminButtonVariants = VariantProps<typeof adminButtonVariants>
