import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const badgeVariants = cva({
  base: 'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent font-formula leading-none font-medium whitespace-nowrap text-primary-warm-gray transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-primary-comfy-yellow/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3',
  variants: {
    size: {
      card: 'px-4 py-2 text-xs',
      feature: 'h-7 px-3 text-sm',
      md: 'px-4 py-1 text-xs',
      xs: 'px-2 py-0.5 text-[9px]',
      xxs: 'px-1.5 py-px text-[8px]'
    },
    variant: {
      default: 'bg-transparency-ink-t80',
      subtle: 'bg-transparency-white-t4 text-primary-comfy-canvas',
      category: 'px-0 font-semibold text-primary-comfy-yellow uppercase',
      accent:
        'relative isolate overflow-visible rounded-none bg-transparent font-bold tracking-wide text-primary-comfy-ink uppercase before:absolute before:inset-0 before:-z-10 before:-skew-x-12 before:rounded-sm before:bg-primary-comfy-yellow',
      callout:
        'relative isolate overflow-visible rounded-none bg-transparent font-bold tracking-tight text-primary-warm-white uppercase before:absolute before:inset-0 before:-z-10 before:-skew-x-12 before:rounded-sm before:bg-primary-comfy-plum'
    }
  },
  defaultVariants: {
    size: 'md',
    variant: 'default'
  }
})

export type BadgeVariants = VariantProps<typeof badgeVariants>
