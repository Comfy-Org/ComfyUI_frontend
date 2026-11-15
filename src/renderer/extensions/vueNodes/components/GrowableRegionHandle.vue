<template>
  <div
    v-if="handle"
    role="separator"
    aria-orientation="horizontal"
    :aria-label="$t('g.resizeRegionHeight')"
    data-testid="growable-region-handle"
    class="group/region-handle pointer-events-auto absolute inset-x-0 -bottom-1 z-20 flex h-2 cursor-row-resize touch-none items-center justify-center"
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

const { name, maxHeight } = defineProps<{
  name: string
  maxHeight?: number
}>()

const handle = inject(growableRegionsKey, undefined)?.handle
</script>
