<script setup lang="ts">
import type { VariantProps } from 'class-variance-authority'
import type { ToggleGroupRootEmits, ToggleGroupRootProps } from 'reka-ui'
import { ToggleGroupRoot, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed, provide } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { toggleVariants } from '@/components/ui/toggle'

type ToggleGroupVariants = VariantProps<typeof toggleVariants>

const {
  class: className,
  variant,
  size,
  spacing = 0,
  ...restProps
} = defineProps<
  ToggleGroupRootProps & {
    class?: HTMLAttributes['class']
    variant?: ToggleGroupVariants['variant']
    size?: ToggleGroupVariants['size']
    spacing?: number
  }
>()

const emits = defineEmits<ToggleGroupRootEmits>()

provide('toggleGroup', {
  variant,
  size,
  spacing
})

const forwarded = useForwardPropsEmits(
  computed(() => ({ ...restProps })),
  emits
)
</script>

<template>
  <ToggleGroupRoot
    v-slot="slotProps"
    data-slot="toggle-group"
    :data-size="size"
    :data-variant="variant"
    :data-spacing="spacing"
    :style="{
      '--gap': spacing
    }"
    v-bind="forwarded"
    :class="
      cn(
        'group/toggle-group ring-primary-warm-white/20 flex w-fit items-center gap-[--spacing(var(--gap))] rounded-2xl p-1.5 ring-2 data-[spacing=default]:data-[variant=outline]:shadow-xs',
        className
      )
    "
  >
    <slot v-bind="slotProps" />
  </ToggleGroupRoot>
</template>
