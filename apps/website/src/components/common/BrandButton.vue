<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

import type { BrandButtonVariants } from './brandButton.variants'
import { brandButtonVariants } from './brandButton.variants'

const {
  href,
  target,
  variant,
  size,
  class: customClass = ''
} = defineProps<{
  href?: string
  target?: string
  variant?: BrandButtonVariants['variant']
  size?: BrandButtonVariants['size']
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    :href
    :target
    :class="cn(brandButtonVariants({ variant, size }), customClass)"
  >
    <span class="ppformula-text-center">
      <slot />
    </span>
  </component>
</template>
