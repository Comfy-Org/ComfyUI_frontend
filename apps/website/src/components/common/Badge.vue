<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { BadgeVariants } from './badge.variants'
import { badgeVariants } from './badge.variants'

const { variant, class: className } = defineProps<{
  variant?: BadgeVariants['variant']
  class?: string
}>()
</script>

<template>
  <span :class="cn(badgeVariants({ variant }), className)">
    <slot />
  </span>
</template>
