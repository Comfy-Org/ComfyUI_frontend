<script setup lang="ts">
import { noop } from 'es-toolkit'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import LODFallback from '../../../components/LODFallback.vue'

defineProps<{
  widget: Pick<SimplifiedWidget<string | number | undefined>, 'name' | 'label'>
}>()
</script>

<template>
  <div class="flex h-[30px] min-w-0 items-center justify-between gap-1">
    <div class="relative flex h-full min-w-0 w-20 items-center">
      <p
        v-if="widget.name"
        class="lod-toggle flex-1 truncate text-xs font-normal text-node-component-slot-text"
      >
        {{ widget.label || widget.name }}
      </p>
      <LODFallback />
    </div>
    <!-- basis-full grow -->
    <div class="relative min-w-0 flex-1">
      <div
        class="lod-toggle cursor-default min-w-0"
        @pointerdown.stop="noop"
        @pointermove.stop="noop"
        @pointerup.stop="noop"
      >
        <slot />
      </div>
      <LODFallback />
    </div>
  </div>
</template>
