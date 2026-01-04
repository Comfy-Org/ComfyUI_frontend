import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const toggleGroupVariants = cva({
  base: 'flex gap-[var(--primitive-padding-padding-1,4px)] p-[var(--primitive-padding-padding-1,4px)] rounded-[var(--primitive-border-radius-rounded-sm,4px)] bg-component-node-widget-background'
})

export const toggleGroupItemVariants = cva({
  base: 'flex-1 inline-flex items-center justify-center border-0 rounded-[var(--primitive-border-radius-rounded-sm,4px)] px-[var(--primitive-padding-padding-2,8px)] py-[var(--primitive-padding-padding-1,4px)] text-xs font-inter font-normal transition-colors cursor-pointer overflow-hidden',
  variants: {
    variant: {
      primary: [
        'data-[state=off]:bg-transparent data-[state=off]:text-muted-foreground',
        'data-[state=off]:hover:bg-component-node-widget-background-hovered data-[state=off]:hover:text-white',
        'data-[state=on]:bg-primary-background data-[state=on]:text-white'
      ],
      secondary: [
        'data-[state=off]:bg-transparent data-[state=off]:text-muted-foreground',
        'data-[state=off]:hover:bg-component-node-widget-background-hovered data-[state=off]:hover:text-white',
        'data-[state=on]:bg-component-node-widget-background-selected data-[state=on]:text-base-foreground'
      ],
      inverted: [
        'data-[state=off]:bg-transparent data-[state=off]:text-muted-foreground',
        'data-[state=off]:hover:bg-component-node-widget-background-hovered data-[state=off]:hover:text-white',
        'data-[state=on]:bg-white data-[state=on]:text-base-background'
      ]
    }
  },
  defaultVariants: {
    variant: 'secondary'
  }
})

export type ToggleGroupItemVariants = VariantProps<
  typeof toggleGroupItemVariants
>
