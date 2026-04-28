import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const dialogContentVariants = cva({
  base: 'data-[state=open]:animate-contentShow fixed top-1/2 left-1/2 z-1700 flex max-h-[85vh] w-[calc(100vw-1rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border-subtle bg-base-background shadow-lg outline-none',
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

const sizes = ['sm', 'md', 'lg', 'xl', 'full'] as const satisfies Array<
  DialogContentVariants['size']
>

export const FOR_STORIES = { sizes } as const
