<script setup lang="ts">
import { ToggleGroupItem } from 'reka-ui'

import { cn } from '../../utils/cn'

const { value, class: cls } = defineProps<{
  value: string
  class?: string
}>()
</script>

<template>
  <ToggleGroupItem
    :value
    :class="
      cn(
        'rounded-agent text-agent-fg-muted hover:text-agent-fg data-[state=on]:bg-agent-surface-raised data-[state=on]:text-agent-fg focus-visible:ring-agent-accent inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none',
        cls
      )
    "
  >
    <slot />
  </ToggleGroupItem>
</template>
