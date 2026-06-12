<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { BadgeVariants } from './badge.variants'
import { badgeVariants } from './badge.variants'

const {
  variant,
  size,
  class: className
} = defineProps<{
  variant?: BadgeVariants['variant']
  size?: BadgeVariants['size']
  class?: string
}>()
</script>

<template>
  <span :class="cn(badgeVariants({ variant, size }), className)">
    <slot />
  </span>
</template>
