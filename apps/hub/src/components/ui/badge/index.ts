import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Badge } from './Badge.vue'

export const badgeVariants = cva(
  'focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default:
          'text-primary-foreground border-transparent bg-primary [a&]:hover:bg-primary/90',
        secondary:
          'bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90 border-transparent',
        destructive:
          'bg-destructive [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 border-transparent text-white',
        outline:
          'text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
        'hub-tag': 'rounded-md border-white/10 bg-white/5 text-white/50',
        'hub-pill':
          'bg-hub-surface text-content h-6 border-transparent px-4 py-1 font-normal transition-opacity [a&]:hover:opacity-80',
        'hub-filter':
          'cursor-pointer rounded-full border-white/10 bg-white/10 font-normal text-white transition-colors hover:bg-white/15'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)
export type BadgeVariants = VariantProps<typeof badgeVariants>
