import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const dialogContentVariants = cva({
  base: 'fixed top-1/2 left-1/2 z-1700 flex max-h-[85vh] w-[calc(100vw-1rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border-subtle bg-base-background shadow-lg outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
  variants: {
    size: {
      sm: 'sm:max-w-sm',
      md: 'sm:max-w-xl',
      lg: 'sm:max-w-3xl',
      xl: 'sm:max-w-5xl',
      full: 'sm:max-w-[calc(100vw-1rem)]'
    }
  },
  defaultVariants: {
    size: 'md'
  }
})

export type DialogContentVariants = VariantProps<typeof dialogContentVariants>

export type DialogContentSize = NonNullable<DialogContentVariants['size']>

const sizes = [
  'sm',
  'md',
  'lg',
  'xl',
  'full'
] as const satisfies Array<DialogContentSize>

export const FOR_STORIES = { sizes } as const
