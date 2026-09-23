<template>
  <div
    ref="rootEl"
    class="pointer-events-none absolute inset-0"
    data-testid="video-crop-overlay"
  >
    <div
      :class="
        cn(
          'pointer-events-auto absolute -m-0.5 box-content cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]',
          disabled && 'pointer-events-none opacity-60'
        )
      "
      :style="cropBoxStyle"
      data-testid="crop-box"
      :aria-label="$t('videoEdit.adjustCrop')"
      @pointerdown.stop="startDrag('move', $event)"
    />
    <div
      v-for="handle in edgeHandles"
      :key="handle.dir"
      :class="
        cn(
          'pointer-events-auto absolute',
          handle.strip,
          handle.cursor,
          disabled && 'pointer-events-none'
        )
      "
      :style="edgeStyle(handle.dir)"
      :data-testid="`crop-handle-${handle.dir}`"
      @pointerdown.stop="startDrag(handle.dir, $event)"
    />
    <div
      v-for="handle in CORNER_HANDLES"
      :key="handle.dir"
      :class="
        cn(
          'pointer-events-auto absolute size-2.5 -translate-1/2 rounded-sm bg-white/80',
          handle.cursor,
          disabled && 'pointer-events-none opacity-60'
        )
      "
      :style="handleStyle(handle.dir)"
      :data-testid="`crop-handle-${handle.dir}`"
      @pointerdown.stop="startDrag(handle.dir, $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, toRef, useTemplateRef } from 'vue'

import { useCropBoxEditor } from '@/composables/video/useCropBoxEditor'
import type { CropResizeDir } from '@/composables/video/useCropBoxEditor'
import type { Bounds } from '@/renderer/core/layout/types'
import { cn } from '@comfyorg/tailwind-utils'

const CORNER_HANDLES: Array<{ dir: CropResizeDir; cursor: string }> = [
  { dir: 'nw', cursor: 'cursor-nwse-resize' },
  { dir: 'ne', cursor: 'cursor-nesw-resize' },
  { dir: 'se', cursor: 'cursor-nwse-resize' },
  { dir: 'sw', cursor: 'cursor-nesw-resize' }
]

const EDGE_HANDLES: Array<{
  dir: CropResizeDir
  cursor: string
  strip: string
}> = [
  { dir: 'n', cursor: 'cursor-ns-resize', strip: 'h-2 -translate-y-1/2' },
  { dir: 'e', cursor: 'cursor-ew-resize', strip: 'w-2 -translate-x-1/2' },
  { dir: 's', cursor: 'cursor-ns-resize', strip: 'h-2 -translate-y-1/2' },
  { dir: 'w', cursor: 'cursor-ew-resize', strip: 'w-2 -translate-x-1/2' }
]

const {
  sourceWidth,
  sourceHeight,
  lockedRatio = null,
  disabled = false
} = defineProps<{
  sourceWidth: number
  sourceHeight: number
  lockedRatio?: number | null
  disabled?: boolean
}>()

const bounds = defineModel<Bounds>({ required: true })

const rootEl = useTemplateRef<HTMLDivElement>('rootEl')

const { startDrag } = useCropBoxEditor(bounds, {
  rootEl,
  sourceWidth: toRef(() => sourceWidth),
  sourceHeight: toRef(() => sourceHeight),
  isDisabled: () => disabled,
  lockedRatio: toRef(() => lockedRatio)
})

function pct(value: number, total: number) {
  return total > 0 ? `${(value / total) * 100}%` : '0%'
}

const cropBoxStyle = computed(() => ({
  left: pct(bounds.value.x, sourceWidth),
  top: pct(bounds.value.y, sourceHeight),
  width: pct(bounds.value.width, sourceWidth),
  height: pct(bounds.value.height, sourceHeight)
}))

function handleStyle(dir: CropResizeDir) {
  const { x, y, width, height } = bounds.value
  const cx = dir.includes('w')
    ? x
    : dir.includes('e')
      ? x + width
      : x + width / 2
  const cy = dir.includes('n')
    ? y
    : dir.includes('s')
      ? y + height
      : y + height / 2
  return { left: pct(cx, sourceWidth), top: pct(cy, sourceHeight) }
}

const edgeHandles = computed(() => (lockedRatio != null ? [] : EDGE_HANDLES))

function edgeStyle(dir: CropResizeDir) {
  const { x, y, width, height } = bounds.value
  if (dir === 'n' || dir === 's') {
    return {
      left: pct(x, sourceWidth),
      top: pct(dir === 'n' ? y : y + height, sourceHeight),
      width: pct(width, sourceWidth)
    }
  }
  return {
    left: pct(dir === 'w' ? x : x + width, sourceWidth),
    top: pct(y, sourceHeight),
    height: pct(height, sourceHeight)
  }
}
</script>
