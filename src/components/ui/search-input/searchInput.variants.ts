import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const searchInputVariants = cva({
  base: 'relative flex w-full cursor-text items-center rounded-lg bg-secondary-background text-base-foreground',
  variants: {
    size: {
      sm: 'h-6 p-1',
      md: 'h-8 px-2 py-1.5',
      lg: 'h-10 p-2',
      xl: 'h-12 p-2'
    }
  },
  defaultVariants: { size: 'md' }
})

export type SearchInputVariants = VariantProps<typeof searchInputVariants>

export const searchInputSizeConfig = {
  sm: {
    icon: 'size-3',
    iconPos: 'left-2',
    inputPl: 'pl-6',
    inputText: 'text-xs',
    clearPos: 'left-1'
  },
  md: {
    icon: 'size-4',
    iconPos: 'left-2.5',
    inputPl: 'pl-8',
    inputText: 'text-xs',
    clearPos: 'left-2.5'
  },
  lg: {
    icon: 'size-4',
    iconPos: 'left-2.5',
    inputPl: 'pl-8',
    inputText: 'text-xs',
    clearPos: 'left-2.5'
  },
  xl: {
    icon: 'size-4',
    iconPos: 'left-2.5',
    inputPl: 'pl-8',
    inputText: 'text-xs',
    clearPos: 'left-2'
  }
} as const

const sizes = ['sm', 'md', 'lg', 'xl'] as const satisfies Array<
  SearchInputVariants['size']
>

export const searchInputStoryConfig = { sizes } as const
