<script setup lang="ts">
import { noop } from 'es-toolkit'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import LODFallback from '../../../components/LODFallback.vue'

defineProps<{
  widget: Pick<SimplifiedWidget<string | number | undefined>, 'name' | 'label'>
}>()
</script>

<template>
  <div
    class="flex h-[30px] min-w-105 items-center justify-between gap-2 overscroll-contain contain-size"
  >
    <div class="relative flex h-6 min-w-28 shrink-1 items-center">
      <p
        v-if="widget.name"
        class="lod-toggle flex-1 truncate text-sm font-normal text-node-component-slot-text"
      >
        {{ widget.label || widget.name }}
      </p>
      <LODFallback />
    </div>
    <div class="relative min-w-75 grow-1">
      <div
        class="lod-toggle cursor-default"
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
