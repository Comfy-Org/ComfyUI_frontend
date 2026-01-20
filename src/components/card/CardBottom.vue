<template>
  <div :class="containerClasses">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const { fullHeight = true } = defineProps<{
  fullHeight?: boolean
}>()

const containerClasses = computed(() =>
  cn('w-full flex-1', fullHeight && 'h-full')
)
</script>
