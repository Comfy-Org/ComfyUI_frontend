<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const { accent } = defineProps<{
  /** Leading-edge colour, e.g. `border-l-success`. */
  accent: string
}>()
</script>

<template>
  <div
    :class="
      cn(
        'pointer-events-auto relative flex items-center gap-12 rounded-lg border border-l-4 bg-background p-4 shadow-md',
        accent
      )
    "
  >
    <div class="flex min-w-0 items-center gap-2">
      <slot name="icon" />
      <div class="flex min-w-0 flex-col text-sm wrap-break-word">
        <span class="font-medium text-foreground">
          <slot name="title" />
        </span>
        <span v-if="$slots.description" class="text-muted-foreground">
          <slot name="description" />
        </span>
      </div>
    </div>
    <slot name="actions" />
  </div>
</template>
