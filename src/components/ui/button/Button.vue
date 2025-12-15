<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import { Primitive } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import type { ButtonVariants } from './button.variants'
import { buttonVariants } from './button.variants'

interface Props extends PrimitiveProps {
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  class?: HTMLAttributes['class']
}

const { as = 'button', class: customClass = '' } = defineProps<Props>()
</script>

<template>
  <Primitive
    :as
    :as-child
    :class="cn(buttonVariants({ variant, size }), customClass)"
  >
    <slot />
  </Primitive>
</template>
