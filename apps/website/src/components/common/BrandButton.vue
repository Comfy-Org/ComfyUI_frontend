<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

import type { BrandButtonVariants } from './brandButton.variants'
import { brandButtonVariants } from './brandButton.variants'

const {
  href,
  variant,
  size,
  class: customClass = ''
} = defineProps<{
  href?: string
  variant?: BrandButtonVariants['variant']
  size?: BrandButtonVariants['size']
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    :href
    :class="cn(brandButtonVariants({ variant, size }), customClass)"
  >
    <span class="ppformula-text-center">
      <slot />
    </span>
  </component>
</template>
