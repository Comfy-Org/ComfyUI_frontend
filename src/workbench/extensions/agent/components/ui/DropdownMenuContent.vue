<script setup lang="ts">
import { DropdownMenuContent, DropdownMenuPortal } from 'reka-ui'

import { cn } from '@comfyorg/tailwind-utils'

const {
  side = 'bottom',
  align = 'end',
  sideOffset = 6,
  class: cls
} = defineProps<{
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  class?: string
}>()
</script>

<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      :side
      :align
      :side-offset="sideOffset"
      :class="
        cn(
          'rounded-agent border-agent-border bg-agent-surface-raised text-agent-fg z-50 min-w-40 overflow-hidden border p-1 shadow-xl focus:outline-none',
          cls
        )
      "
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>
