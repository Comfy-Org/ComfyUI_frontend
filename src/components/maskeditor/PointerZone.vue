<template>
  <div
    ref="pointerZoneRef"
    data-testid="pointer-zone"
    class="h-full w-[calc(100%-4rem-220px)]"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointerleave="handlePointerLeave"
    @pointerenter="handlePointerEnter"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
    @wheel.prevent="handleWheel"
    @contextmenu.prevent
  />
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import type { usePanAndZoom } from '@/composables/maskeditor/usePanAndZoom'
import type { useToolManager } from '@/composables/maskeditor/useToolManager'
import { useMaskEditorStore } from '@/stores/maskEditorStore'

const { toolManager, panZoom } = defineProps<{
  toolManager: ReturnType<typeof useToolManager>
  panZoom: ReturnType<typeof usePanAndZoom>
}>()

const store = useMaskEditorStore()
const pointerZoneRef = ref<HTMLDivElement>()

onMounted(() => {
  if (!pointerZoneRef.value) {
    console.error('[PointerZone] Pointer zone ref not initialized')
    return
  }

  store.pointerZone = pointerZoneRef.value
})

watch(
  () => store.isPanning,
  (isPanning) => {
    if (!pointerZoneRef.value) return

    if (isPanning) {
      pointerZoneRef.value.style.cursor = 'grabbing'
    } else {
      toolManager.updateCursor()
    }
  }
)

async function handlePointerDown(event: PointerEvent) {
  await toolManager.handlePointerDown(event)
}

async function handlePointerMove(event: PointerEvent) {
  await toolManager.handlePointerMove(event)
}

function handlePointerUp(event: PointerEvent) {
  void toolManager.handlePointerUp(event)
}

function handlePointerLeave() {
  store.brushVisible = false
  if (pointerZoneRef.value) {
    pointerZoneRef.value.style.cursor = ''
  }
}

function handlePointerEnter() {
  toolManager.updateCursor()
}

function handleTouchStart(event: TouchEvent) {
  panZoom.handleTouchStart(event)
}

async function handleTouchMove(event: TouchEvent) {
  await panZoom.handleTouchMove(event)
}

function handleTouchEnd(event: TouchEvent) {
  panZoom.handleTouchEnd(event)
}

async function handleWheel(event: WheelEvent) {
  await panZoom.zoom(event)
  const newCursorPoint = { x: event.clientX, y: event.clientY }
  panZoom.updateCursorPosition(newCursorPoint)
}
</script>
