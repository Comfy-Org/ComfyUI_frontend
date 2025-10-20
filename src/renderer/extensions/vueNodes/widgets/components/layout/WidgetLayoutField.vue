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
    class="flex h-[30px] items-center justify-between gap-2 overscroll-contain"
  >
    <div class="relative flex h-6 items-center">
      <p
        v-if="widget.name"
        class="lod-toggle w-28 flex-1 truncate text-sm font-normal text-node-component-slot-text"
      >
        {{ widget.label || widget.name }}
      </p>
      <LODFallback />
    </div>
    <div class="relative">
      <div
        class="lod-toggle w-75 cursor-default"
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
