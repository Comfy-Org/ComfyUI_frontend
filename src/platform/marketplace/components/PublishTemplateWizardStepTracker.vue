<template>
  <div class="flex gap-2 text-sm text-muted">
    <span
      v-for="(step, idx) in steps"
      :key="step.id"
      :class="
        cn(
          'rounded-full px-3 py-1 select-none',
          currentStep === idx + 1
            ? 'text-highlight-foreground bg-highlight'
            : 'bg-base-background'
        )
      "
    >
      {{ step.label }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@/utils/tailwindUtil'

defineProps<{
  steps: ReadonlyArray<{ id: string; label: string }>
  currentStep: number
}>()
</script>
