<script setup lang="ts">
import { noop } from 'es-toolkit'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import LODFallback from '../../../components/LODFallback.vue'

defineProps<{
  widget: Pick<SimplifiedWidget<string | number | undefined>, 'name'>
}>()
</script>

<template>
  <div
    class="flex items-center justify-between gap-2 h-[30px] overscroll-contain"
  >
    <div class="relative h-6 flex items-center mr-4">
      <p
        v-if="widget.name"
        class="text-sm text-stone-200 dark-theme:text-slate-200 font-normal flex-1 truncate w-full lod-toggle"
      >
        {{ widget.name }}
      </p>
      <LODFallback />
    </div>
    <div class="relative">
      <div
        class="w-75 cursor-default lod-toggle"
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
