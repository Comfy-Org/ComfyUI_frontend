<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()

const modelValue = defineModel<string | number>()
</script>

<template>
  <textarea
    v-model="modelValue"
    :class="
      cn(
        'flex min-h-20 w-full appearance-none resize-none rounded-lg border-none bg-secondary-background px-4 py-2 font-inter text-sm text-base-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-default disabled:pointer-events-none disabled:opacity-50',
        className
      )
    "
  />
</template>
