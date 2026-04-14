<template>
  <div class="relative aspect-square" :style="containerStyle">
    <div
      v-for="(url, i) in visibleImages"
      :key="i"
      class="absolute overflow-hidden rounded-lg border border-border-default bg-modal-card-placeholder-background shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
      :class="isStack ? 'inset-[8%]' : 'inset-0'"
      :style="layerStyle(i)"
    >
      <img v-if="url" :src="url" alt="" class="size-full object-cover" />
      <div v-else class="flex size-full items-center justify-center">
        <i class="icon-[lucide--image] size-8 text-muted-foreground" />
      </div>
    </div>
    <div
      v-if="count > 1"
      class="absolute right-2 bottom-2 z-10 flex items-center gap-1 rounded-md bg-base-background/80 px-2 py-1 text-xs font-medium text-base-foreground backdrop-blur-sm"
    >
      <i class="icon-[lucide--layers] size-3" />
      {{ count }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const {
  images = [],
  count = 0,
  maxVisible = 3
} = defineProps<{
  /** Preview URLs for the top images in the stack */
  images: string[]
  /** Total number of selected assets */
  count: number
  /** Maximum number of stacked layers to show */
  maxVisible?: number
}>()

// Back layers fan out, front image sits flat on top
const ROTATIONS = [-4, 3, 0]
const OFFSETS = [
  { x: -4, y: -3 },
  { x: 5, y: -2 },
  { x: 0, y: 0 }
]

const isStack = computed(() => images.length > 1)
const visibleImages = computed(() => images.slice(0, maxVisible))

const stackDepth = computed(() =>
  Math.min(visibleImages.value.length, maxVisible)
)

const containerStyle = computed(() => ({}))

function layerStyle(index: number) {
  if (!isStack.value) return { zIndex: 0 }

  const depth = stackDepth.value
  const reverseIndex = depth - 1 - index
  const rotation = ROTATIONS[index % ROTATIONS.length]
  const offset = OFFSETS[index % OFFSETS.length]

  return {
    transform: `rotate(${rotation}deg) translate(${offset.x}px, ${offset.y}px)`,
    zIndex: reverseIndex
  }
}
</script>
