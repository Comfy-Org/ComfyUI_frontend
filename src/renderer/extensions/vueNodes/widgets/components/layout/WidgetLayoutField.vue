<script setup lang="ts">
import { noop } from 'es-toolkit'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import LODFallback from '../../../components/LODFallback.vue'

defineProps<{
  widget: Pick<SimplifiedWidget<string | number | undefined>, 'name' | 'label'>
}>()
</script>

<template>
  <div class="flex h-[30px] min-w-0 items-center justify-between gap-2">
    <div class="relative flex h-6 min-w-0 items-center" style="min-width: 3ch">
      <p
        v-if="widget.name"
        class="lod-toggle w-16  min-w-0 truncate text-sm font-normal text-node-component-slot-text"
      >
        {{ widget.label || widget.name }}
      </p>
      <LODFallback />
    </div>
    <div class="relative min-w-0 flex-1" style="min-width: 3ch">
      <div
        class="lod-toggle min-w-0 cursor-default"
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
