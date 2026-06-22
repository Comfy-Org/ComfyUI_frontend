<script setup lang="ts">
import type { ToggleEmits, ToggleProps } from 'reka-ui'
import { Toggle, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { ToggleVariants } from '.'
import { toggleVariants } from '.'

const {
  class: className,
  variant = 'default',
  size = 'default',
  ...restProps
} = defineProps<
  ToggleProps & {
    class?: HTMLAttributes['class']
    variant?: ToggleVariants['variant']
    size?: ToggleVariants['size']
  }
>()

const emits = defineEmits<ToggleEmits>()

const forwarded = useForwardPropsEmits(
  computed(() => ({ ...restProps })),
  emits
)
</script>

<template>
  <Toggle
    v-slot="slotProps"
    data-slot="toggle"
    v-bind="forwarded"
    :class="cn(toggleVariants({ variant, size }), className)"
  >
    <slot v-bind="slotProps" />
  </Toggle>
</template>
