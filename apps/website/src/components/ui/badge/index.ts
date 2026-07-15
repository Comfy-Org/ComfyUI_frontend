import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const badgeVariants = cva({
  base: 'text-primary-warm-gray font-formula leading-none focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] [&>svg]:pointer-events-none [&>svg]:size-3',
  variants: {
    size: {
      md: 'px-4 py-1 text-xs',
      xs: 'px-2 py-0.5 text-[9px]',
      xxs: 'px-1.5 py-px text-[8px]'
    },
    variant: {
      default: 'bg-transparency-ink-t80',
      subtle: 'bg-transparency-white-t4 text-primary-comfy-canvas',
      category: 'text-primary-comfy-yellow px-0 font-semibold uppercase',
      accent:
        'before:bg-primary-comfy-yellow relative isolate overflow-visible rounded-none bg-transparent font-bold tracking-wide text-primary-comfy-ink uppercase before:absolute before:inset-0 before:-z-10 before:-skew-x-12 before:rounded-sm'
    }
  },
  defaultVariants: {
    size: 'md',
    variant: 'default'
  }
})

export type BadgeVariants = VariantProps<typeof badgeVariants>
