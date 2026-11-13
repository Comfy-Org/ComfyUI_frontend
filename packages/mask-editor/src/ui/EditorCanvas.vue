<template>
  <div
    ref="containerRef"
    data-testid="mask-editor-root"
    class="relative isolate flex size-full flex-col overflow-hidden"
    @contextmenu.prevent
    @dragstart="handleDragStart"
    @keydown.stop
  >
    <div
      id="maskEditorCanvasContainer"
      ref="canvasContainerRef"
      class="absolute inset-0 isolate"
      @contextmenu.prevent
    >
      <canvas
        ref="imgCanvasRef"
        data-testid="mask-editor-image-canvas"
        class="absolute top-0 left-0 size-full"
        @contextmenu.prevent
      />
      <canvas
        ref="rgbCanvasRef"
        class="absolute top-0 left-0 z-10 size-full"
        @contextmenu.prevent
      />
      <canvas
        ref="maskCanvasRef"
        data-testid="mask-editor-mask-canvas"
        class="absolute top-0 left-0 z-30 size-full"
        @contextmenu.prevent
      />
      <canvas
        ref="gpuCanvasRef"
        class="pointer-events-none absolute top-0 left-0 size-full"
        :class="{
          'z-20': store.activeLayer === 'rgb',
          'z-40': store.activeLayer === 'mask'
        }"
      />
      <div ref="canvasBackgroundRef" class="size-full" />
      <svg
        v-if="overlayPoints.length"
        data-testid="mask-editor-tool-overlay"
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 z-50 size-full"
        :viewBox="`0 0 ${store.canvasHistory.dimensions?.width ?? 0} ${store.canvasHistory.dimensions?.height ?? 0}`"
      >
        <circle
          v-for="point in overlayPoints"
          :key="point.id"
          :cx="point.x"
          :cy="point.y"
          :r="point.radius"
          :fill="point.color"
        />
      </svg>
    </div>

    <LoadingOverlay :loading="!initialized" size="sm" />

    <div
      data-testid="mask-editor-ui"
      class="relative isolate flex min-h-0 flex-1 flex-col"
    >
      <div class="flex min-h-0 flex-1 overflow-hidden">
        <ToolPanel
          v-if="initialized"
          :tool-manager="toolManager!"
          :extension-active="extensionTools?.isActive()"
        >
          <slot name="extension-tools" />
        </ToolPanel>

        <PointerZone
          v-if="initialized"
          :tool-manager="toolManager!"
          :pan-zoom="panZoom!"
        />

        <SidePanel v-if="initialized" :tool-manager="toolManager!">
          <template v-if="extensionTools?.isActive()" #settings>
            <slot name="extension-settings" />
          </template>
        </SidePanel>
      </div>
    </div>

    <BrushCursor v-if="initialized" :container-ref="containerRef" />
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import { useCanvasManager } from '#/useCanvasManager'
import { useKeyboard } from '#/useKeyboard'
import { usePanAndZoom } from '#/usePanAndZoom'
import { useToolManager } from '#/useToolManager'
import type { MaskEditorToolDelegate } from '#/useToolManager'
import type { MaskEditorOverlayPoint } from '#/extensionTypes'
import { useMaskEditorStore } from '#/maskEditorStore'

import LoadingOverlay from '@comfyorg/design-system/common/LoadingOverlay'

import BrushCursor from './components/BrushCursor.vue'
import PointerZone from './components/PointerZone.vue'
import SidePanel from './components/SidePanel.vue'
import ToolPanel from './components/ToolPanel.vue'

const {
  baseImage,
  maskImage,
  paintImage,
  brushAdjustment,
  extensionTools,
  overlayPoints = []
} = defineProps<{
  extensionTools?: MaskEditorToolDelegate
  overlayPoints?: readonly MaskEditorOverlayPoint[]
  baseImage: HTMLImageElement
  maskImage: HTMLImageElement
  paintImage?: HTMLImageElement
  brushAdjustment?: Parameters<typeof useToolManager>[2]
}>()

const emit = defineEmits<{
  ready: []
  error: [error: unknown]
}>()

const store = useMaskEditorStore()
const canvasManager = useCanvasManager()

const containerRef = ref<HTMLElement>()
const canvasContainerRef = ref<HTMLDivElement>()
const imgCanvasRef = ref<HTMLCanvasElement>()
const maskCanvasRef = ref<HTMLCanvasElement>()
const rgbCanvasRef = ref<HTMLCanvasElement>()
const gpuCanvasRef = ref<HTMLCanvasElement>()
const canvasBackgroundRef = ref<HTMLDivElement>()

const initialized = ref(false)

const keyboard = useKeyboard(containerRef)
const panZoom = usePanAndZoom()

const toolManager = useToolManager(
  keyboard,
  panZoom,
  brushAdjustment,
  extensionTools
)

let resizeObserver: ResizeObserver | null = null
let disposed = false

const handleDragStart = (event: DragEvent) => {
  if (event.ctrlKey) {
    event.preventDefault()
  }
}

const initUI = async (
  container: HTMLElement,
  maskCanvas: HTMLCanvasElement,
  gpuCanvas: HTMLCanvasElement
) => {
  try {
    await nextTick()
    if (disposed) return

    const image = await canvasManager.initializeImages(
      baseImage,
      maskImage,
      paintImage
    )
    if (disposed) return

    await panZoom.initializeCanvasPanZoom(image, container)
    if (disposed) return

    store.canvasHistory.saveInitialState()

    await toolManager.brushDrawing.initGPUResources()
    if (disposed) return

    gpuCanvas.width = maskCanvas.width
    gpuCanvas.height = maskCanvas.height

    toolManager.brushDrawing.initPreviewCanvas(gpuCanvas)

    initialized.value = true
    emit('ready')
  } catch (error) {
    if (!disposed) emit('error', error)
  }
}

onMounted(() => {
  keyboard.addListeners()

  if (!containerRef.value) {
    console.error('[EditorCanvas] Cannot initialize - missing required refs')
    return
  }

  if (
    !imgCanvasRef.value ||
    !maskCanvasRef.value ||
    !rgbCanvasRef.value ||
    !gpuCanvasRef.value ||
    !canvasContainerRef.value ||
    !canvasBackgroundRef.value
  ) {
    console.error('[EditorCanvas] Cannot initialize - missing canvas refs')
    return
  }

  store.maskCanvas = maskCanvasRef.value
  store.rgbCanvas = rgbCanvasRef.value
  store.imgCanvas = imgCanvasRef.value
  store.canvasContainer = canvasContainerRef.value
  store.canvasBackground = canvasBackgroundRef.value

  resizeObserver = new ResizeObserver(async () => {
    await panZoom.invalidatePanZoom()
  })
  resizeObserver.observe(containerRef.value)

  void initUI(containerRef.value, maskCanvasRef.value, gpuCanvasRef.value)
})

onBeforeUnmount(() => {
  disposed = true
  keyboard?.removeListeners()

  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }

  store.canvasHistory.clearStates()

  store.resetState()
})
</script>
