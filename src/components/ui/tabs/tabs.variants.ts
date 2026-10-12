import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const tabsListVariants = cva({
  base: 'inline-flex items-center gap-2',
  variants: {
    variant: {
      default: '',
      bordered: 'gap-1 border-b border-border-default',
      panel: 'border-b border-solid border-border-default bg-transparent py-2',
      flush: 'gap-0'
    }
  },
  defaultVariants: { variant: 'default' }
})

export const tabsTriggerVariants = cva({
  base: 'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border-none bg-transparent px-2.5 text-sm whitespace-nowrap text-muted-foreground transition-all duration-200 outline-none focus-visible:ring-1 focus-visible:ring-border-default disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-secondary-background data-[state=active]:text-base-foreground data-[state=inactive]:hover:bg-secondary-background/50',
  variants: {
    variant: {
      default: '',
      panel: 'm-1 mx-2 p-3 font-inter',
      flush:
        'h-auto rounded-none px-4 py-2 font-medium data-[state=active]:bg-transparent'
    }
  },
  defaultVariants: { variant: 'default' }
})

export type TabsListVariants = VariantProps<typeof tabsListVariants>
export type TabsTriggerVariants = VariantProps<typeof tabsTriggerVariants>
