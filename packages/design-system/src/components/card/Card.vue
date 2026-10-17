<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { CardVariants } from './card.variants.js'
import { cardVariants } from './card.variants.js'

const { class: className, surface } = defineProps<{
  class?: HTMLAttributes['class']
  surface?: CardVariants['surface']
}>()
</script>

<template>
  <div :class="cn(cardVariants({ surface }), className)">
    <slot />
  </div>
</template>
