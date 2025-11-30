<script setup lang="ts">
import { noop } from 'es-toolkit'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

defineProps<{
  widget: Pick<SimplifiedWidget<string | number | undefined>, 'name' | 'label'>
}>()
</script>

<template>
  <div
    class="grid grid-cols-subgrid h-7.5 min-w-0 items-center justify-between gap-1"
  >
    <div class="relative flex h-full min-w-0 items-center">
      <p
        v-if="widget.name"
        class="flex-1 truncate text-xs font-normal text-node-component-slot-text"
      >
        {{ widget.label || widget.name }}
      </p>
    </div>
    <!-- basis-full grow -->
    <div class="relative min-w-0 flex-1">
      <div
        class="cursor-default min-w-0"
        @pointerdown.stop="noop"
        @pointermove.stop="noop"
      >
        <slot />
      </div>
    </div>
  </div>
</template>
