import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const triggerVariants = cva({
  base: 'relative inline-flex w-full items-center justify-between gap-2 cursor-pointer select-none rounded-md border border-border-default bg-secondary-background text-base-foreground transition-colors hover:bg-secondary-background-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none',
  variants: {
    size: {
      sm: 'h-6 px-2 text-xs',
      md: 'h-8 px-3 text-xs',
      lg: 'h-10 px-4 text-sm'
    },
    variant: {
      secondary: 'bg-secondary-background hover:bg-secondary-background-hover',
      primary:
        'bg-primary-background text-base-foreground hover:bg-primary-background-hover',
      destructive:
        'bg-destructive-background text-base-foreground hover:bg-destructive-background-hover',
      textonly:
        'border-transparent bg-transparent hover:bg-secondary-background-hover'
    },
    border: {
      none: '',
      active: 'border-node-component-border',
      invalid: 'border-destructive-background'
    }
  },
  defaultVariants: {
    size: 'md',
    variant: 'secondary',
    border: 'none'
  }
})

export type TriggerVariants = VariantProps<typeof triggerVariants>

export const contentVariants = cva({
  base: 'z-50 min-w-(--reka-combobox-trigger-width) overflow-hidden rounded-md border border-border-default bg-base-background text-base-foreground shadow-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2'
})

export const itemVariants = cva({
  base: 'relative flex cursor-pointer select-none items-center gap-2 px-2 py-1.5 text-xs text-base-foreground outline-none transition-colors hover:bg-secondary-background-hover data-highlighted:bg-secondary-background-selected data-[state=checked]:bg-secondary-background-selected data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  variants: {
    layout: {
      single: 'rounded-sm',
      multi: 'gap-2 rounded-sm'
    }
  },
  defaultVariants: {
    layout: 'single'
  }
})

export type ItemVariants = VariantProps<typeof itemVariants>

export const searchVariants = cva({
  base: 'flex w-full items-center gap-2 border-b border-border-default px-3 py-1.5'
})

export const listVariants = cva({
  base: 'flex max-h-[16rem] flex-col gap-0 overflow-y-auto p-1 text-xs scrollbar-custom'
})
