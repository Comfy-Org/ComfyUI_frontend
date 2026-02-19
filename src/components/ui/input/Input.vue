<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()

const modelValue = defineModel<string | number>()
</script>

<template>
  <input
    v-model="modelValue"
    :class="
      cn(
        'flex h-10 w-full min-w-0 appearance-none rounded-lg border-none bg-secondary-background px-4 py-2 text-sm text-base-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-default disabled:pointer-events-none disabled:opacity-50',
        className
      )
    "
  />
</template>
