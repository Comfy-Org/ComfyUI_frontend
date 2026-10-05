import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const fieldVariants = cva({
  base: 'group/field flex w-full gap-3 data-[invalid=true]:text-destructive-background',
  variants: {
    orientation: {
      vertical: 'flex-col *:w-full [&>.sr-only]:w-auto',
      horizontal: 'flex-row items-center *:data-[slot=field-label]:flex-auto'
    }
  },
  defaultVariants: { orientation: 'vertical' }
})

export type FieldVariants = VariantProps<typeof fieldVariants>
