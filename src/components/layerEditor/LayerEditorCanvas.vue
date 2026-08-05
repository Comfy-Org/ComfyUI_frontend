<template>
  <div
    ref="viewportRef"
    tabindex="0"
    data-testid="layer-editor-viewport"
    class="relative min-h-0 min-w-0 flex-1 touch-none overflow-hidden bg-base-background outline-none"
    :style="{ cursor: viewportCursor }"
    @pointerdown="session.onPointerDown"
    @pointermove="session.onPointerMove"
    @pointerup="session.onPointerUp"
    @pointerleave="session.onPointerLeave"
    @wheel.prevent="session.onWheel"
    @keydown="session.onKeyDown"
    @keyup="session.onKeyUp"
    @contextmenu.prevent
  >
    <div
      ref="containerRef"
      class="pointer-events-none absolute top-0 left-0"
      :style="checkerboardStyle"
    >
      <canvas
        ref="mainRef"
        data-testid="layer-editor-main-canvas"
        class="absolute top-0 left-0 block size-full"
      />
    </div>
    <canvas
      ref="overlayRef"
      class="pointer-events-none absolute inset-0 size-full"
    />
  </div>
</template>

<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { onMounted, ref } from 'vue'

import type { LayerEditorSession } from '@/composables/layerEditor/useLayerEditorSession'

const { session } = defineProps<{ session: LayerEditorSession }>()

const viewportRef = ref<HTMLDivElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const mainRef = ref<HTMLCanvasElement | null>(null)
const overlayRef = ref<HTMLCanvasElement | null>(null)

const { viewportCursor } = session

const checkerboardStyle = {
  backgroundImage:
    'conic-gradient(#6a6a6a 25%, #4c4c4c 0 50%, #6a6a6a 0 75%, #4c4c4c 0)',
  backgroundSize: '8px 8px',
  boxShadow: '0 0 0 1px rgb(0 0 0 / 0.9), 0 4px 16px rgb(0 0 0 / 0.55)'
}

let firstLayout = true
useResizeObserver(viewportRef, () => {
  if (firstLayout) {
    firstLayout = false
    session.fitView()
    return
  }
  session.panZoom.invalidate()
  session.requestRender()
})

onMounted(() => {
  if (
    !viewportRef.value ||
    !containerRef.value ||
    !mainRef.value ||
    !overlayRef.value
  )
    return
  session.setElements({
    viewport: viewportRef.value,
    container: containerRef.value,
    main: mainRef.value,
    overlay: overlayRef.value
  })
})
</script>
