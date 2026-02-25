import type { InjectionKey, Ref } from 'vue'

import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const toggleGroupVariantKey: InjectionKey<
  Ref<ToggleGroupItemVariants['variant']>
> = Symbol('toggleGroupVariant')

export const toggleGroupVariants = cva({
  base: 'flex items-center justify-center gap-1',
  variants: {
    variant: {
      default: 'bg-transparent',
      outline: 'bg-transparent',
      pill: 'rounded-full bg-comfy-menu-bg p-1'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
})

export const toggleGroupItemVariants = cva({
  base: [
    'inline-flex items-center justify-center',
    'border-none cursor-pointer appearance-none',
    'text-center font-normal',
    'transition-all duration-150 ease-in-out',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
    'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed'
  ],
  variants: {
    variant: {
      default: [
        'rounded bg-transparent text-text-secondary',
        'hover:bg-interface-menu-component-surface-selected/50',
        'data-[state=on]:bg-interface-menu-component-surface-selected data-[state=on]:text-text-primary'
      ],
      outline: [
        'rounded border border-border-default bg-transparent text-text-secondary',
        'hover:bg-secondary-background',
        'data-[state=on]:bg-interface-menu-component-surface-selected data-[state=on]:text-text-primary'
      ],
      pill: [
        'rounded-full bg-transparent text-comfy-input-foreground',
        'data-[state=on]:bg-white data-[state=on]:text-comfy-input data-[state=on]:font-medium'
      ]
    },
    size: {
      default: 'h-7 px-3 text-sm',
      sm: 'h-6 px-5 py-[5px] text-xs',
      lg: 'h-9 px-4 text-sm'
    }
  },
  defaultVariants: {
    variant: 'default',
    size: 'default'
  }
})

export type ToggleGroupVariants = VariantProps<typeof toggleGroupVariants>
export type ToggleGroupItemVariants = VariantProps<
  typeof toggleGroupItemVariants
>
