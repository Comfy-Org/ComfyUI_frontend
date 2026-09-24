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
      outline: 'bg-transparent'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
})

export const toggleGroupItemVariants = cva({
  base: [
    'inline-flex items-center justify-center rounded-sm',
    'cursor-pointer appearance-none border-none',
    'text-center font-normal',
    'transition-all duration-150 ease-in-out',
    'focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
    'data-[state=on]:bg-secondary-background data-[state=on]:text-base-foreground'
  ],
  variants: {
    variant: {
      default:
        'bg-transparent text-muted-foreground hover:bg-secondary-background/50',
      outline:
        'border border-border-default bg-transparent text-muted-foreground hover:bg-secondary-background'
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
