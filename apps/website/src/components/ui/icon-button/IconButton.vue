<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import type { IconButtonVariants } from '.'
import { Primitive } from 'reka-ui'
import { cn } from '@comfyorg/tailwind-utils'
import { iconButtonVariants } from '.'

interface Props extends PrimitiveProps {
  variant?: IconButtonVariants['variant']
  size?: IconButtonVariants['size']
  class?: HTMLAttributes['class']
  disabled?: boolean
}

const {
  as = 'button',
  asChild,
  variant,
  size,
  class: className,
  disabled
} = defineProps<Props>()
</script>

<template>
  <Primitive
    data-slot="icon-button"
    :data-variant="variant"
    :data-size="size"
    :as
    :as-child
    :disabled
    :class="cn(iconButtonVariants({ variant, size }), className)"
  >
    <slot />
  </Primitive>
</template>
