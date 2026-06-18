import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const badgeVariants = cva({
  base: 'text-primary-warm-gray focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-4 py-1 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] [&>svg]:pointer-events-none [&>svg]:size-3',
  variants: {
    variant: {
      default: 'bg-transparency-ink-t80',
      subtle: 'bg-transparency-white-t4 text-primary-comfy-canvas'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
})

export type BadgeVariants = VariantProps<typeof badgeVariants>
