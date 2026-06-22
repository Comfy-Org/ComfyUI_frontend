<script setup lang="ts">
import type { ToggleEmits, ToggleProps } from 'reka-ui'
import { Toggle, useForwardPropsEmits } from 'reka-ui'
import type { Component, HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { ToggleVariants } from '.'
import { toggleVariants } from '.'

const {
  class: className,
  variant = 'default',
  size = 'default',
  prependIcon,
  appendIcon,
  ...restProps
} = defineProps<
  ToggleProps & {
    class?: HTMLAttributes['class']
    variant?: ToggleVariants['variant']
    size?: ToggleVariants['size']
    prependIcon?: Component
    appendIcon?: Component
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
    <slot name="prepend">
      <component :is="prependIcon" v-if="prependIcon" />
    </slot>
    <span class="ppformula-text-center">
      <slot v-bind="slotProps" />
    </span>
    <slot name="append">
      <component :is="appendIcon" v-if="appendIcon" />
    </slot>
  </Toggle>
</template>
