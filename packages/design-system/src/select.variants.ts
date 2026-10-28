import { cva } from 'cva'

export const selectTriggerVariants = cva({
  base: 'relative inline-flex cursor-pointer items-center rounded-lg border-[2.5px] border-solid bg-secondary text-foreground transition-all duration-200 ease-in-out outline-none select-none hover:bg-accent disabled:cursor-default disabled:opacity-30 disabled:hover:bg-secondary',
  variants: {
    size: {
      md: 'h-8',
      lg: 'h-10'
    },
    border: {
      none: 'border-transparent focus-visible:border-border data-[state=open]:border-border',
      active: 'border-foreground',
      invalid: 'border-destructive'
    }
  },
  defaultVariants: {
    size: 'lg',
    border: 'none'
  }
})

export const selectItemVariants = cva({
  base: 'flex cursor-pointer items-center px-2 outline-none hover:bg-accent',
  variants: {
    layout: {
      multi:
        'h-10 shrink-0 gap-2 rounded-lg data-highlighted:bg-muted data-highlighted:hover:bg-muted',
      single:
        'relative w-full justify-between gap-3 rounded-sm py-3 text-sm select-none focus:bg-accent data-[state=checked]:bg-muted data-[state=checked]:hover:bg-muted'
    }
  },
  defaultVariants: {
    layout: 'multi'
  }
})

export const selectContentClass =
  'z-overlay overflow-hidden rounded-lg p-2 bg-background text-foreground border border-solid shadow-md data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2'

export const selectDropdownClass =
  'flex shrink-0 cursor-pointer items-center justify-center pl-3 [&_i]:size-5'

export const selectEmptyMessageClass = 'px-3 pb-4 text-sm text-muted-foreground'

export const selectCountBadgeClass =
  'flex size-3.5 items-center justify-center rounded-full bg-foreground text-[9px] font-semibold text-background'

export function stopEscapeToDocument(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    event.stopImmediatePropagation()
  }
}
