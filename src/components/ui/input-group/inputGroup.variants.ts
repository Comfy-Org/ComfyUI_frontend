import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const inputGroupAddonVariants = cva({
  base: 'flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none group-has-[[data-slot=input-group-control]:disabled]/input-group:opacity-50',
  variants: {
    align: {
      'inline-start': 'order-first pl-3 has-[>button]:pl-1',
      'inline-end': 'order-last pr-3 has-[>button]:pr-1'
    }
  },
  defaultVariants: { align: 'inline-start' }
})

export type InputGroupAddonVariants = VariantProps<
  typeof inputGroupAddonVariants
>

export const inputGroupButtonVariants = cva({
  base: 'flex items-center gap-2 text-sm',
  variants: {
    size: {
      xs: 'h-6 gap-1 rounded-sm px-2',
      sm: 'h-8 gap-1.5 rounded-md px-2.5',
      'icon-xs': 'size-6 rounded-sm p-0',
      'icon-sm': 'size-8 p-0'
    }
  },
  defaultVariants: { size: 'xs' }
})

export type InputGroupButtonVariants = VariantProps<
  typeof inputGroupButtonVariants
>
