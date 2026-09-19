<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const { accent } = defineProps<{
  /** Leading-edge colour, e.g. `border-l-success-background`. */
  accent: string
}>()
</script>

<template>
  <div
    :class="
      cn(
        'pointer-events-auto relative flex items-center gap-12 rounded-lg border border-l-4 border-interface-stroke bg-interface-panel-surface p-4 shadow-interface',
        accent
      )
    "
  >
    <div class="flex items-center gap-2">
      <slot name="icon" />
      <div class="flex flex-col">
        <span class="text-sm font-medium text-base-foreground">
          <slot name="title" />
        </span>
        <span v-if="$slots.description" class="text-sm text-muted-foreground">
          <slot name="description" />
        </span>
      </div>
    </div>
    <slot name="actions" />
  </div>
</template>
