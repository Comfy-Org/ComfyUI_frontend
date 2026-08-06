import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const buttonVariants = cva({
  base: 'relative inline-flex items-center justify-center gap-2 cursor-pointer touch-manipulation whitespace-nowrap appearance-none border-none rounded-md text-sm font-medium font-inter transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([width]):not([height])]:size-4 [&_svg]:shrink-0',
  variants: {
    variant: {
      secondary:
        'text-secondary-foreground bg-secondary-background hover:bg-secondary-background-hover',
      primary:
        'bg-primary-background text-base-foreground hover:bg-primary-background-hover',
      inverted:
        'bg-base-foreground text-base-background hover:bg-base-foreground/80',
      destructive:
        'bg-destructive-background text-base-foreground hover:bg-destructive-background-hover',
      textonly:
        'bg-transparent text-base-foreground hover:bg-secondary-background-hover',
      'muted-textonly':
        'bg-transparent text-muted-foreground hover:bg-secondary-background-hover',
      'destructive-textonly':
        'bg-transparent text-destructive-background hover:bg-destructive-background/10',
      link: 'bg-transparent text-muted-foreground hover:text-base-foreground',
      'overlay-white': 'bg-white text-gray-600 hover:bg-white/90',
      base: 'bg-base-background text-base-foreground hover:bg-secondary-background-hover',
      tertiary:
        'bg-tertiary-background text-base-foreground hover:bg-tertiary-background-hover',
      subscribe:
        'border-transparent bg-credit text-charcoal-800 hover:opacity-80',
      'brand-ghost':
        'bg-transparency-white-t8 text-primary-warm-white hover:bg-transparency-white-t20 focus-visible:ring-2 focus-visible:ring-brand-yellow',
      'brand-solid':
        'focus-visible:ring-primary-warm-white bg-brand-yellow text-primary-comfy-ink hover:bg-brand-yellow/90 focus-visible:ring-2',
      'brand-ghost-accent':
        'bg-transparency-white-t8 text-primary-warm-white hover:bg-brand-yellow hover:text-primary-comfy-ink focus-visible:ring-2 focus-visible:ring-brand-yellow'
    },
    size: {
      sm: 'h-6 rounded-sm px-2 py-1 text-xs',
      md: 'h-8 rounded-lg p-2 text-xs',
      lg: 'h-10 rounded-lg px-4 py-2 text-sm',
      'icon-sm': 'size-5 p-0',
      icon: 'size-8',
      'icon-lg': 'size-10',
      brand:
        'font-formula h-12 rounded-2xl px-5 text-sm font-semibold tracking-[0.7px] uppercase lg:h-13 xl:h-14 2xl:h-16',
      'brand-icon': 'size-10 rounded-2xl xl:size-12',
      unset: ''
    }
  },

  defaultVariants: {
    variant: 'secondary',
    size: 'md'
  }
})

export type ButtonVariants = VariantProps<typeof buttonVariants>

const variants = [
  'secondary',
  'primary',
  'inverted',
  'destructive',
  'textonly',
  'muted-textonly',
  'destructive-textonly',
  'link',
  'base',
  'tertiary',
  'overlay-white',
  'subscribe',
  'brand-ghost',
  'brand-solid',
  'brand-ghost-accent'
] as const satisfies Array<ButtonVariants['variant']>
const sizes = [
  'sm',
  'md',
  'lg',
  'icon-sm',
  'icon',
  'icon-lg',
  'brand',
  'brand-icon'
] as const satisfies Array<ButtonVariants['size']>

export const FOR_STORIES = { variants, sizes } as const
