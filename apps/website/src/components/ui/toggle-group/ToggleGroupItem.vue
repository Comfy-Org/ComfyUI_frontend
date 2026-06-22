<script setup lang="ts">
import type { VariantProps } from 'class-variance-authority'
import type { ToggleGroupItemProps } from 'reka-ui'
import { ToggleGroupItem, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed, inject } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { toggleVariants } from '@/components/ui/toggle'

type ToggleGroupVariants = VariantProps<typeof toggleVariants> & {
  spacing?: number
}

const {
  class: className,
  variant,
  size,
  ...restProps
} = defineProps<
  ToggleGroupItemProps & {
    class?: HTMLAttributes['class']
    variant?: ToggleGroupVariants['variant']
    size?: ToggleGroupVariants['size']
  }
>()

const context = inject<ToggleGroupVariants>('toggleGroup')

const forwardedProps = useForwardProps(computed(() => ({ ...restProps })))
</script>

<template>
  <ToggleGroupItem
    v-slot="slotProps"
    data-slot="toggle-group-item"
    :data-variant="context?.variant || variant"
    :data-size="context?.size || size"
    :data-spacing="context?.spacing"
    v-bind="forwardedProps"
    :class="
      cn(
        toggleVariants({
          variant: context?.variant || variant,
          size: context?.size || size
        }),
        'w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10',
        'data-[spacing=0]:rounded-none data-[spacing=0]:shadow-none data-[spacing=0]:first:rounded-l-xl data-[spacing=0]:last:rounded-r-xl data-[spacing=0]:data-[variant=outline]:border-l-0 data-[spacing=0]:data-[variant=outline]:first:border-l',
        className
      )
    "
  >
    <slot v-bind="slotProps" />
  </ToggleGroupItem>
</template>
