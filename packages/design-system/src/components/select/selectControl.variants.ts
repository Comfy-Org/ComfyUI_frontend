import { cva } from 'cva'

export const selectControlRecipe = {
  base: 'flex w-full cursor-pointer items-center justify-between select-none rounded-lg bg-secondary text-foreground transition-all duration-200 ease-in-out hover:bg-accent border-[2.5px] border-solid focus:outline-none data-placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-secondary [&>span]:truncate',
  variants: {
    size: {
      md: 'h-8 px-3 py-1 text-xs',
      lg: 'h-10 px-4 py-2 text-sm'
    },
    invalid: {
      true: 'border-destructive',
      false: 'border-transparent focus:border-border'
    }
  },
  defaultVariants: { size: 'lg', invalid: false }
} as const

export const selectControlVariants = cva(selectControlRecipe)
