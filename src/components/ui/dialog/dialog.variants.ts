import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const dialogContentVariants = cva({
  base: 'fixed z-1700 flex flex-col rounded-lg border border-border-subtle bg-base-background shadow-lg outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
  variants: {
    size: {
      sm: 'sm:max-w-sm',
      md: 'sm:max-w-xl',
      lg: 'sm:max-w-3xl',
      xl: 'sm:max-w-5xl',
      full: 'sm:max-w-[calc(100vw-1rem)]'
    },
    maximized: {
      true: 'inset-2 top-2 left-2 size-auto max-h-none max-w-none sm:max-w-none',
      false: 'top-1/2 left-1/2 max-h-[85vh] w-[calc(100vw-1rem)] -translate-1/2'
    }
  },
  defaultVariants: {
    size: 'md',
    maximized: false
  }
})

type DialogContentVariants = VariantProps<typeof dialogContentVariants>

export type DialogContentSize = NonNullable<DialogContentVariants['size']>

const sizes = [
  'sm',
  'md',
  'lg',
  'xl',
  'full'
] as const satisfies Array<DialogContentSize>

export const FOR_STORIES = { sizes } as const
