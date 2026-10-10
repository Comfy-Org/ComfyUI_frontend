import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const dialogContentVariants = cva({
  base: 'fixed z-1700 flex flex-col outline-none data-[state=closed]:pointer-events-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
  variants: {
    surface: {
      card: 'rounded-2xl border border-border-default bg-base-background shadow-lg',
      none: ''
    },
    size: {
      sm: 'sm:max-w-96',
      md: 'sm:max-w-xl',
      lg: 'sm:max-w-3xl',
      xl: 'sm:max-w-5xl',
      full: '',
      fit: ''
    },
    maximized: {
      true: 'inset-2 top-2 left-2 size-auto max-h-none max-w-none sm:max-w-none',
      false:
        'top-1/2 left-1/2 max-h-[85vh] w-[calc(100vw-1rem)] translate-x-[calc(-50%-min(var(--workspace-inset-right,0px)/2,max(0px,(50vw-50%-var(--workspace-inset-right,0px)/2-0.5rem+1px)*1000)))] -translate-y-1/2'
    }
  },
  compoundVariants: [
    {
      size: 'full',
      maximized: false,
      class:
        'h-[90vh] max-h-[90vh] w-[90vw] max-w-[min(90vw,calc(100vw-var(--workspace-inset-right,0px)-1rem))]'
    },
    {
      size: 'fit',
      maximized: false,
      class: 'w-fit max-w-[calc(100vw-1rem)]'
    }
  ],
  defaultVariants: {
    surface: 'card',
    size: 'md',
    maximized: false
  }
})

type DialogContentVariants = VariantProps<typeof dialogContentVariants>

export type DialogContentSize = NonNullable<DialogContentVariants['size']>
export type DialogContentSurface = NonNullable<DialogContentVariants['surface']>

const sizes = [
  'sm',
  'md',
  'lg',
  'xl',
  'full',
  'fit'
] as const satisfies Array<DialogContentSize>

const surfaces = ['card', 'none'] as const satisfies Array<DialogContentSurface>

export const FOR_STORIES = { sizes, surfaces } as const
