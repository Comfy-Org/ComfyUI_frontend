<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import type { AnchorHTMLAttributes, Component, HTMLAttributes } from 'vue'
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
  href?: AnchorHTMLAttributes['href']
}

const {
  as,
  asChild,
  variant,
  size,
  class: className,
  disabled,
  prependIcon,
  appendIcon,
  href
} = defineProps<Props>()
</script>

<template>
  <Primitive
    data-slot="button"
    :data-variant="variant"
    :data-size="size"
    :as="as ?? (href != null && !disabled ? 'a' : 'button')"
    :as-child
    :disabled
    :href="disabled ? undefined : href"
    :class="cn(buttonVariants({ variant, size }), className)"
  >
    <slot name="prepend">
      <component :is="prependIcon" v-if="prependIcon" />
    </slot>
    <span class="ppformula-text-center">
      <slot />
    </span>
    <slot name="append">
      <component :is="appendIcon" v-if="appendIcon" />
    </slot>
  </Primitive>
</template>
