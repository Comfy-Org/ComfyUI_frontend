<template>
  <div
    ref="rootEl"
    class="pointer-events-none absolute inset-0 overflow-hidden"
    data-testid="video-crop-overlay"
  >
    <div
      :class="
        cn(
          'pointer-events-auto absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]',
          disabled && 'pointer-events-none opacity-60'
        )
      "
      :style="cropBoxStyle"
      data-testid="crop-box"
      :aria-label="$t('videoEdit.adjustCrop')"
      @pointerdown.stop="startDrag('move', $event)"
    />
    <div
      v-for="handle in HANDLES"
      :key="handle.dir"
      :class="
        cn(
          'pointer-events-auto absolute size-2.5 -translate-1/2 border border-black/40 bg-white',
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

const HANDLES: Array<{ dir: CropResizeDir; cursor: string }> = [
  { dir: 'nw', cursor: 'cursor-nwse-resize' },
  { dir: 'n', cursor: 'cursor-ns-resize' },
  { dir: 'ne', cursor: 'cursor-nesw-resize' },
  { dir: 'e', cursor: 'cursor-ew-resize' },
  { dir: 'se', cursor: 'cursor-nwse-resize' },
  { dir: 's', cursor: 'cursor-ns-resize' },
  { dir: 'sw', cursor: 'cursor-nesw-resize' },
  { dir: 'w', cursor: 'cursor-ew-resize' }
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
</script>
