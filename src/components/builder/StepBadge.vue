<template>
  <div
    class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-ocean-600 text-white"
  >
    <i v-if="modelValue === step.id" :class="cn(step.icon, 'size-5')" />
    <span v-else class="text-sm font-bold">
      {{ index + 1 }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { BuilderToolbarStep } from './types'

defineProps<{
  step: BuilderToolbarStep
  index: number
  modelValue: string
}>()
</script>
