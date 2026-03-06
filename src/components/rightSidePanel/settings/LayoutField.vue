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
          'group truncate text-sm text-muted-foreground',
          tooltip ? 'cursor-help' : '',
          singleline ? 'flex-1' : ''
        )
      "
    >
      {{ label }}

      <i
        v-if="tooltip"
        class="relative top-px ml-0.5 icon-[lucide--info] size-3 group-hover:text-primary"
      />
    </span>
    <slot />
  </div>
</template>
