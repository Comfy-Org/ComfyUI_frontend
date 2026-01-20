<template>
  <div
    :class="
      cn(
        'flex shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-secondary-background p-0 shadow-sm outline-hidden transition-all duration-200',
        backgroundClass
      )
    "
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@/utils/tailwindUtil'

const { backgroundClass } = defineProps<{
  backgroundClass?: string
}>()
</script>
