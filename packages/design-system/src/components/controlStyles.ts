import { cva } from 'cva'

export const checkboxClass =
  'inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm border bg-transparent text-background transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=indeterminate]:border-foreground data-[state=indeterminate]:bg-foreground'

export const checkboxIndicator = {
  checked: 'size-3 icon-[lucide--check]',
  indeterminate: 'size-3 icon-[lucide--minus]'
}

export const inputClass =
  'flex h-10 w-full min-w-0 appearance-none rounded-lg border-none bg-secondary px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-1 aria-invalid:ring-destructive'

export const textareaClass =
  'flex min-h-16 w-full scrollbar-gutter-stable rounded-lg border-none bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-1 aria-invalid:ring-destructive'

export const sliderRootClass =
  'relative flex w-full touch-none items-center select-none data-disabled:opacity-50'
export const sliderTrackClass = 'rounded-full bg-muted-foreground/20'
export const sliderHorizontalTrackClass =
  'data-[orientation=horizontal]:h-0.5 data-[orientation=horizontal]:w-full'
export const sliderThumbClass =
  'block size-3.5 shrink-0 rounded-full bg-foreground shadow-sm ring-foreground transition-[color,box-shadow] cursor-grab hover:ring-2 focus-visible:ring-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50'

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
