import { cva } from 'cva'

export const selectTriggerVariants = cva({
  base: 'relative inline-flex cursor-pointer items-center select-none rounded-lg bg-secondary-background text-base-foreground transition-all duration-200 ease-in-out hover:bg-secondary-background-hover border-[2.5px] border-solid disabled:cursor-default disabled:opacity-30 disabled:hover:bg-secondary-background',
  variants: {
    size: {
      md: 'h-8',
      lg: 'h-10'
    },
    border: {
      none: 'border-transparent focus-visible:border-node-component-border data-[state=open]:border-node-component-border',
      active: 'border-base-foreground',
      invalid: 'border-destructive-background'
    }
  },
  defaultVariants: {
    size: 'lg',
    border: 'none'
  }
})

export const selectItemVariants = cva({
  base: 'flex cursor-pointer items-center px-2 outline-none hover:bg-secondary-background-hover',
  variants: {
    layout: {
      multi:
        'h-10 shrink-0 gap-2 rounded-lg data-highlighted:bg-secondary-background-selected data-highlighted:hover:bg-secondary-background-selected',
      single:
        'relative w-full justify-between gap-3 rounded-sm py-3 text-sm select-none focus:bg-secondary-background-hover data-[state=checked]:bg-secondary-background-selected data-[state=checked]:hover:bg-secondary-background-selected'
    }
  },
  defaultVariants: {
    layout: 'multi'
  }
})

export const selectContentClass =
  'z-3000 overflow-hidden rounded-lg p-2 bg-base-background text-base-foreground border border-solid border-border-default shadow-md data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2'

export const selectDropdownClass =
  'flex shrink-0 cursor-pointer items-center justify-center px-3'

export const selectEmptyMessageClass = 'px-3 pb-4 text-sm text-muted-foreground'

export function stopEscapePropagation(event: KeyboardEvent) {
  if (event.code === 'Escape') event.stopPropagation()
}
