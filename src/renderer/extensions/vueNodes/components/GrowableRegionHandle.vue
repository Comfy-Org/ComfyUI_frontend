<template>
  <div
    v-if="handle"
    role="separator"
    aria-orientation="horizontal"
    :aria-label="label"
    data-testid="growable-region-handle"
    class="group/region-handle pointer-events-auto absolute inset-x-0 bottom-[calc(-1*var(--spacing)-var(--node-widget-gap)/2)] z-20 flex h-2 cursor-row-resize touch-none items-center justify-center"
    @pointerdown.stop="handle.start($event, name, maxHeight)"
    @dblclick.stop="handle.reset($event, name)"
  >
    <div
      class="h-0.5 w-8 rounded-full bg-muted-foreground opacity-0 transition-opacity group-hover/region-handle:opacity-100"
    />
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'

import { growableRegionsKey } from '@/renderer/extensions/vueNodes/layout/useGrowableRegions'

const { name, label, maxHeight } = defineProps<{
  name: string
  label: string
  maxHeight?: number
}>()

const handle = inject(growableRegionsKey, undefined)?.handle
</script>
