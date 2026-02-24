import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const searchInputVariants = cva({
  base: 'relative flex w-full cursor-text items-center rounded-lg bg-secondary-background text-base-foreground',
  variants: {
    size: {
      sm: 'h-8 px-2 py-1.5',
      md: 'h-10 px-4 py-2',
      lg: 'h-12 px-4 py-2'
    }
  },
  defaultVariants: { size: 'md' }
})

export type SearchInputVariants = VariantProps<typeof searchInputVariants>

const sizes = ['sm', 'md', 'lg'] as const satisfies Array<
  SearchInputVariants['size']
>

export const FOR_STORIES = { sizes } as const
