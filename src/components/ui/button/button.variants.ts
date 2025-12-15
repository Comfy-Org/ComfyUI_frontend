import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const buttonVariants = cva({
  base: 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  variants: {
    variant: {
      secondary:
        'bg-secondary-background text-secondary-foreground hover:bg-secondary-background-hover',
      primary:
        'bg-primary-background text-base-foreground hover:bg-primary-background-hover',
      inverted:
        'bg-base-foreground text-base-background hover:bg-base-foreground/80',
      destructive:
        'bg-destructive-background text-base-foreground hover:bg-destructive-background-hover',
      'destructive-subtle':
        'bg-secondary-background text-base-foreground hover:bg-destructive-background-hover'
    },
    size: {
      sm: 'h-6 rounded-sm px-2 py-1 text-xs',
      md: 'h-8 rounded-lg p-2 text-xs',
      lg: 'h-10 rounded-lg px-4 py-2 text-sm',
      icon: 'size-9'
    }
  },
  defaultVariants: {
    variant: 'secondary',
    size: 'md'
  }
})

export type ButtonVariants = VariantProps<typeof buttonVariants>
