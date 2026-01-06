<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

defineProps<{
  label: string
  tooltip?: string
  singleline?: boolean
}>()
</script>

<template>
  <div
    :class="
      cn('flex gap-2', singleline ? 'items-center justify-between' : 'flex-col')
    "
  >
    <span
      v-tooltip.left="
        tooltip
          ? {
              value: tooltip,
              showDelay: 300
            }
          : null
      "
      :class="
        cn(
          'text-sm text-muted-foreground cursor-pointer truncate',
          singleline ? 'flex-1' : ''
        )
      "
    >
      {{ label }}
    </span>
    <slot />
  </div>
</template>
