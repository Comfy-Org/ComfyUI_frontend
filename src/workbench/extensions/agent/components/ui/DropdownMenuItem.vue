<script setup lang="ts">
import { DropdownMenuItem } from 'reka-ui'

import { cn } from '@comfyorg/tailwind-utils'

const { class: cls, disabled } = defineProps<{
  class?: string
  disabled?: boolean
}>()
</script>

<template>
  <DropdownMenuItem
    :disabled
    :class="
      cn(
        'rounded-agent text-agent-fg data-[highlighted]:bg-agent-surface-hover flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50',
        cls
      )
    "
  >
    <slot />
  </DropdownMenuItem>
</template>
