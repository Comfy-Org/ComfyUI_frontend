import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const buttonVariants = cva({
  base: 'focus-visible:ring-ring relative inline-flex cursor-pointer appearance-none items-center justify-center gap-2 rounded-md border-none font-inter text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
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
      'overlay-white': 'bg-white text-gray-600 hover:bg-white/90'
    },
    size: {
      sm: 'h-6 rounded-sm px-2 py-1 text-xs',
      md: 'h-8 rounded-lg p-2 text-xs',
      lg: 'h-10 rounded-lg px-4 py-2 text-sm',
      icon: 'size-8',
      'icon-sm': 'size-5 p-0'
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
  'overlay-white'
] as const satisfies Array<ButtonVariants['variant']>
const sizes = ['sm', 'md', 'lg', 'icon', 'icon-sm'] as const satisfies Array<
  ButtonVariants['size']
>

export const FOR_STORIES = { variants, sizes } as const
