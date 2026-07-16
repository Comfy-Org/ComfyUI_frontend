<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import type { Component, HTMLAttributes } from 'vue'
import type { ButtonVariants } from '.'
import { Primitive } from 'reka-ui'
import { cn } from '@comfyorg/tailwind-utils'
import { buttonVariants } from '.'

interface Props extends PrimitiveProps {
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  class?: HTMLAttributes['class']
  disabled?: boolean
  prependIcon?: Component
  appendIcon?: Component
}

const {
  as = 'button',
  asChild,
  variant,
  size,
  class: className,
  disabled,
  prependIcon,
  appendIcon
} = defineProps<Props>()
</script>

<template>
  <Primitive
    data-slot="button"
    :data-variant="variant"
    :data-size="size"
    :as
    :as-child
    :disabled
    :class="cn(buttonVariants({ variant, size }), className)"
  >
    <slot name="prepend">
      <component :is="prependIcon" v-if="prependIcon" />
    </slot>
    <span>
      <slot />
    </span>
    <slot name="append">
      <component :is="appendIcon" v-if="appendIcon" />
    </slot>
  </Primitive>
</template>
