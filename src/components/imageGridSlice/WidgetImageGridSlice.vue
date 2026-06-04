<template>
  <div
    class="widget-expands flex size-full flex-col gap-1"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <div
      class="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-node-component-surface"
    >
      <div
        v-if="inputImageUrl"
        class="relative max-h-full w-full"
        data-testid="grid-slice-preview"
      >
        <img
          :src="inputImageUrl"
          class="block size-full object-contain"
          draggable="false"
          @dragstart.prevent
        />
        <svg
          class="pointer-events-none absolute inset-0 size-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line
            v-for="x in verticalLines"
            :key="`v-${x}`"
            :x1="x * 100"
            :x2="x * 100"
            y1="0"
            y2="100"
            class="stroke-blue-400"
            stroke-width="0.5"
            vector-effect="non-scaling-stroke"
          />
          <line
            v-for="y in horizontalLines"
            :key="`h-${y}`"
            x1="0"
            x2="100"
            :y1="y * 100"
            :y2="y * 100"
            class="stroke-blue-400"
            stroke-width="0.5"
            vector-effect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div
        v-else
        class="flex flex-col items-center gap-2 p-4 text-center text-xs text-muted-foreground"
        data-testid="grid-slice-empty"
      >
        <i class="icon-[lucide--grid-3x3] size-6" />
        {{ $t('imageGridSlice.connectImage') }}
      </div>
    </div>

    <div
      class="text-center text-xs text-muted-foreground"
      data-testid="grid-slice-dimensions"
    >
      {{
        $t('imageGridSlice.gridSummary', {
          rows,
          columns,
          tiles: rows * columns
        })
      }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useImageGridSlice } from '@/composables/imageGridSlice/useImageGridSlice'

const { nodeId } = defineProps<{
  nodeId: string
}>()

const { rows, columns, horizontalLines, verticalLines, inputImageUrl } =
  useImageGridSlice(nodeId)
</script>
