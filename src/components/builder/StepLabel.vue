<template>
  <div class="flex flex-col gap-1 text-left">
    <span class="text-layout-lg font-medium text-base-foreground">
      {{ step.title }}
    </span>
    <span
      class="hidden text-layout-md whitespace-nowrap text-muted-foreground sm:inline"
    >
      {{ step.subtitle }}
    </span>
  </div>
</template>

<script setup lang="ts">
import type { BuilderToolbarStep } from './types'

const { step } = defineProps<{
  step: BuilderToolbarStep
}>()
</script>
